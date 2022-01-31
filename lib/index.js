const { Transform } = require("stream");
const { Constants, getNodeIndices } = require("./util");

class Xtreamer extends Transform {

    constructor (node, options) {
        super();
        this._xmlString = "";
        this.charBuffer = Buffer.alloc(4);
        this.charReceived = 0;
        this.charLength = 0;
        this._node = node;
        this._options = options;
    }

    async _transform (chunk, encoding, callback) {
        try {
            await this._parse(chunk);
            return callback();
        } catch (error) {
            return callback(error);
        }
    }

    _flush (done) {
        done();
    }

    async _parse (chunk) {
        this._xmlString += this._getUTF8(chunk);
        if(this._xmlString && this._xmlString.length >= this._options.max_xml_size) {
            var oError = Error(`Max limit (${this._options.max_xml_size} characters) of xml string is exceeded - ${this._xmlString.length}`);
            this._error = oError;
            return this.destroy(oError);
        }
        let nodeIndices = getNodeIndices(this._xmlString, this._node);
        //no matching start tag was found, reset xmlString. keep the last characters which might be part of an opening tag (including "<>")
        if(!nodeIndices || nodeIndices.length === 0) this._xmlString = this._xmlString.substr(this._xmlString.length - this._node.length - 2);
        //if no complete nodes existing wait for the next chunk
        nodeIndices = nodeIndices.filter(i => i.start && i.end);
        if(!nodeIndices || !nodeIndices.length) return;
        let nodes = [];
        for(let index = 0; index < nodeIndices.length; index++) {
            const nodeObj = nodeIndices[index];
            const xmlNode = this._xmlString.slice(nodeObj.start, nodeObj.end + 1); // include character at nodeObj.end
            this._options && this._options.transformer && typeof this._options.transformer === "function" ?
                this.push(JSON.stringify(await this._options.transformer(xmlNode))) :
                this.push(xmlNode);
            this.emit(Constants.XML_DATA, xmlNode);
            
            nodes.push(xmlNode);
        }
        nodes.forEach(node => { this._xmlString = this._xmlString.replace(node, ""); });
    }

    // implementation based on http://debuggable.com/posts/streaming-utf-8-with-node-js:4bf28e8b-a290-432f-a222-11c1cbdd56cb
    _getUTF8 (buffer) {
        var out = '';
        // if our last write ended with an incomplete multibyte character
        if (this.charLength) {
            // determine how many remaining bytes this buffer has to offer for this char
            var i = (buffer.length >= this.charLength - this.charReceived)
            ? this.charLength - this.charReceived
            : buffer.length;

            // add the new bytes to the char buffer
            buffer.copy(this.charBuffer, this.charReceived, 0, i);
            this.charReceived += i;

            if (this.charReceived < this.charLength) {
                // still not enough chars in this buffer? wait for more ...
                return out;
            }

            // get the character that was split
            out = this.charBuffer.slice(0, this.charLength).toString();
            this.charReceived = this.charLength = 0;

            //console.log(`xtreamer: found ${i} bytes at the beginning of utf-8 string, which need to combined with the previous bytes into a "${out}"`);

            if (i == buffer.length) {
                // if there are no more bytes in this buffer, just emit our char
                return out;
            }
            // otherwise cut of the characters end from the beginning of this buffer
            buffer = buffer.slice(i, buffer.length);
        }
        
        // determine how many bytes we have to check at the end of this buffer
        var i = (buffer.length >= 3) ? 3 : buffer.length;

        // figure out if one of the last i bytes of our buffer announces an incomplete char
        for (; i > 0; i--) {
            let c = buffer[buffer.length - i];
            // See http://en.wikipedia.org/wiki/UTF-8#Description

            // 110XXXXX
            if (i == 1 && c >> 5 == 0x06) {
                this.charLength = 2;
                break;
            }

            // 1110XXXX
            if (i <= 2 && c >> 4 == 0x0E) {
                this.charLength = 3;
                break;
            }

            // 11110XXX
            if (i <= 3 && c >> 3 == 0x1E) {
                this.charLength = 4;
                break;
            }
        }

        if (!this.charLength) {
            // no incomplete char at the end of this buffer, emit the whole thing
            return out + buffer.toString();
        }

        // buffer the incomplete character bytes we got
        buffer.copy(this.charBuffer, 0, buffer.length - i, buffer.length);
        this.charReceived = i;
        //console.log(`xtreamer: found ${i} bytes at the end of utf-8 string, which need to be preserved`);

        if (buffer.length - i > 0) {
        // buffer had more bytes before the incomplete char, emit them
            return out + buffer.slice(0, buffer.length - i).toString();
        } else if (charStr) {
        // or just emit the charStr if any
            return out;
        }
    }
}

module.exports = (node, options = { max_xml_size: Constants.MAX_XML_LENGTH }) => {
    if(!node || !node.trim()) {
        throw Error("invalid node name provided!");
    }
    options = options || {};
    options.max_xml_size = options.max_xml_size || Constants.MAX_XML_LENGTH;
    return new Xtreamer(node, options);
};
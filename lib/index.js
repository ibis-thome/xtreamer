const { Transform } = require("stream");
const { Constants, getNodeIndices } = require("./util");

class Xtreamer extends Transform {

    constructor (node, options) {
        super();
        this._xmlString = "";
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
        this._xmlString += chunk.toString();
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
}

module.exports = (node, options = { max_xml_size: Constants.MAX_XML_LENGTH }) => {
    if(!node || !node.trim()) {
        throw Error("invalid node name provided!");
    }
    options = options || {};
    options.max_xml_size = options.max_xml_size || Constants.MAX_XML_LENGTH;
    return new Xtreamer(node, options);
};
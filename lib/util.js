const Constants = {
    XML_DATA: "xmldata",
    MAX_XML_LENGTH: 10000000
};


const _getIndices = (xmlString, subString) => {

    let indices = [];
    let offset = 0;

    if(!xmlString || !xmlString.trim() || !subString || !subString.trim()) {
        return indices;
    }

    while(offset <= xmlString.length) {
        const index = xmlString.indexOf(subString, offset);

        // no occurance
        if(index < 0) {
            offset = xmlString.length + 1;
        } else {
            offset = index + subString.length;
            indices.push(index);
        }
    }

    return indices;
};

const _getStartTagIndices = (xmlString, node) => {

    let indices = [];

    if(!xmlString || !xmlString.trim() || !node || !node.trim()) {
        return indices;
    }

    const startTag1 = `<${node} `;
    const startTag2 = `<${node}>`;

    indices = [
        ...indices,
        ..._getIndices(xmlString, startTag1),
        ..._getIndices(xmlString, startTag2)
    ];

    return indices;
};

const _getEndTagIndices = (xmlString, node) => {
    
    let indices = [];

    if(!xmlString || !xmlString.trim() || !node || !node.trim()) {
        return indices;
    }

    const endTag = `</${node}>`;

    return _getIndices(xmlString, endTag).map(i => i + endTag.length - 1);
};

const _getSelfClosingTags = (xmlString) => {

    let indices = [];

    if(!xmlString || !xmlString.trim()) {
        return indices;
    }

    const endTag = `/>`;

    return [
        ...indices,
        ..._getIndices(xmlString, endTag)
    ];
}

//  array of array
const _getCommentIndices = (xmlString) => {
    
    let indices = [];

    if(!xmlString || !xmlString.trim()) {
        return indices;
    }

    const startOfComment = "<!--";
    const endOfComment = "-->";

    indices = [
        _getIndices(xmlString, startOfComment),
        _getIndices(xmlString, endOfComment)
    ];

    return indices;
};

//  array of array
const _getCdataIndices = (xmlString) => {
    
    let indices = [];

    if(!xmlString || !xmlString.trim()) {
        return indices;
    }

    const startOfCdata = "<![CDATA[";
    const endOfCdata = "]]>";

    indices = [
        _getIndices(xmlString, startOfCdata),
        _getIndices(xmlString, endOfCdata)
    ];

    return indices;
};

const _isInvalidTagIndex = (validateTagIndex, matrix, xmlString) => {
    // check if the start tag is present in any of the comments. If yes, skip it.
    return matrix[0].some((commentIndex, cIndex) => {
        matrix[1][cIndex] = matrix[1][cIndex] || xmlString.length;
        return validateTagIndex > matrix[0][cIndex] && validateTagIndex < matrix[1][cIndex];
    });
}

/**
 * 
 * @param {object} oParams 
 * @param {integer[]} startIndices
 * @param {integer[]} endIndices
 * @param {integer} index
 * @param {array[]} commentMatrix
 * @param {array[]} cDataMatrix
 * @param {string} xmlString
 * @param {integer} [offset] default = 1
 * @param {integer[]} selfClosingIndices - but for all possible tag types
 */
const _getMatchingEndIndex = (oParams) => {
    oParams.offset = oParams.offset != undefined ? oParams.offset : 1;
    // check if the end tag index is present in any of the comments / cdata. If yes, skip it.
    if(_isInvalidTagIndex(oParams.endIndices[oParams.index], oParams.commentMatrix, oParams.xmlString) ||
        _isInvalidTagIndex(oParams.endIndices[oParams.index], oParams.cDataMatrix, oParams.xmlString)) {
        oParams.offset++;
    } 
	
    if((oParams.startIndices[oParams.index + 1] && (oParams.startIndices[oParams.index + 1] < oParams.endIndices[oParams.index]) || !oParams.endIndices[oParams.index]) || (!oParams.startIndices[oParams.index + 1] && !oParams.endIndices[oParams.index])) {
        let sSearchForSelfClosing = oParams.xmlString.substring(oParams.startIndices[oParams.index] + 1, oParams.startIndices[oParams.index + 1]);
        let oSelfClosingRegex = new RegExp("^[^<>]+/>");
        let bSelfClosing = oSelfClosingRegex.test(sSearchForSelfClosing);
        if(bSelfClosing) {
            let iMatchingSelfClosingIndex = oParams.selfClosingIndices.findIndex(i => i > oParams.startIndices[oParams.index]);
            oParams.endIndices.splice(oParams.index, 0, oParams.selfClosingIndices[iMatchingSelfClosingIndex] + 1);
            return oParams.index;
        }
        return oParams.endIndices.length;
        /*
         *let sNextClosingTagSubString = oParams.xmlString.substring(oParams.startIndices[oParams.index] + 1, oParams.endIndices[iPossibleMatchingIndex]);
         *if(sNextClosingTagSubString.indexOf("<") >= 0) return -1;
         */
        
    } else {
        if(oParams.startIndices[oParams.index + oParams.offset] < oParams.endIndices[oParams.index]) {
            return _getMatchingEndIndex({ 
                startIndices: oParams.startIndices, 
                endIndices: oParams.endIndices, 
                index: oParams.index + 1, 
                commentMatrix: oParams.commentMatrix, 
                cDataMatrix: oParams.cDataMatrix, 
                xmlString: oParams.xmlString, 
                offset: oParams.offset
            });
        }
		
        if(oParams.startIndices[oParams.index] >= oParams.endIndices[oParams.index]) {
            let endIndex = oParams.index;
            while(oParams.startIndices[oParams.index] >= oParams.endIndices[endIndex]) {
                endIndex++; 
            }
            return endIndex;
        }
		
        return oParams.index;
    }
};

// returns array [{start: number, end: number}]
const _getNodeIndices = (xmlString, node) => {

    const nodeIndices = [];
    let skipIndex = -1;
    //let bSelfClosing = false;

    if(!xmlString || !xmlString.trim() || !node || !node.trim()) {
        return nodeIndices;
    }

    let startIndices = _getStartTagIndices(xmlString, node);
    let endIndices = _getEndTagIndices(xmlString, node);
    let selfClosingIndices = [];

    let commentMatrix = _getCommentIndices(xmlString);
    let cDataMatrix = _getCdataIndices(xmlString);
	
    if(startIndices && startIndices.length && (!endIndices || !endIndices.length || endIndices.length < startIndices.length)) {
        selfClosingIndices = _getSelfClosingTags(xmlString, node);
    }

    if(!startIndices || !startIndices.length) {
        return [];
    }
    if((!endIndices || !endIndices.length) && (!selfClosingIndices || !selfClosingIndices.length)) {
        return startIndices.map(startIndex => {
            return {
                start: startIndex,
                end: undefined,
                selfClosing: undefined
            };
        });
    }

    startIndices.sort((a, b) => a - b);
    endIndices.sort((a, b) => a - b);

    startIndices.forEach((startIndex, index, array) => {

        // check if the start tag index is present in any of the comments / cdata. If yes, skip it.
        if(_isInvalidTagIndex(startIndex, commentMatrix, xmlString) ||
            _isInvalidTagIndex(startIndex, cDataMatrix, xmlString) ||
            skipIndex >= index) {
            return;
        }

        // get next logical start tag index
        skipIndex = _getMatchingEndIndex({ 
            startIndices: array, 
            endIndices: endIndices, 
            index: index, 
            commentMatrix: commentMatrix, 
            cDataMatrix: cDataMatrix, 
            xmlString: xmlString,
            selfClosingIndices: selfClosingIndices
        });

        nodeIndices.push({
            start: startIndex,
            end: endIndices[skipIndex]//,
            //selfClosing: bSelfClosing
        });
        //if(bSelfClosing) skipIndex = -1;
    });

    return nodeIndices;
};

module.exports = {
    Constants: Constants,
    getNodeIndices: _getNodeIndices
};
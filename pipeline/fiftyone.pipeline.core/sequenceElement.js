/* *********************************************************************
 * This Original Work is copyright of 51 Degrees Mobile Experts Limited.
 * Copyright 2026 51 Degrees Mobile Experts Limited, Davidson House,
 * Forbury Square, Reading, Berkshire, United Kingdom RG1 3EU.
 *
 * This Original Work is licensed under the European Union Public Licence
 * (EUPL) v.1.2 and is subject to its terms as set out below.
 *
 * If a copy of the EUPL was not distributed with this file, You can obtain
 * one at https://opensource.org/licenses/EUPL-1.2.
 *
 * The 'Compatible Licences' set out in the Appendix to the EUPL (as may be
 * amended by the European Commission) shall be deemed incompatible for
 * the purposes of the Work and the provisions of the compatibility
 * clause in Article 5 of the EUPL shall not apply.
 *
 * If using the Work as, or as part of, a network application, by
 * including the attribution notice(s) required under Article 5 of the EUPL
 * in the end user terms of the application under an appropriate heading,
 * such notice(s) shall fulfill the requirements of that article.
 * ********************************************************************* */

const crypto = require('crypto');

const FlowElement = require('./flowElement.js');
const ElementDataDictionary = require('./elementDataDictionary.js');
const BasicListEvidenceKeyFilter = require('./basicListEvidenceKeyFilter');

// The largest sequence that can be given, so that one more is still a
// 32 bit whole number.
const MaxGivenSequence = 2147483646;
const SequencePattern = /^[0-9]{1,10}$/;

/**
 * @typedef {import('./flowData')} FlowData
 */

/**
 * The SequenceElement stores session data regarding requests
 * for client side JavaScript from the JavaScript created by a
 * Pipeline's JavaScriptBuilder
 * If a Pipeline is constructed with the JavaScript elements enabled
 * this is added automatically along with the JavaScriptBuilder and JSONBundler.
 **/
class SequenceElement extends FlowElement {
  constructor () {
    super({
      properties: {
        'session-id': {
          name: 'session-id',
          type: 'string',
          description: 'An identifier for this session.'
        },
        sequence: {
          name: 'sequence',
          type: 'int',
          description: 'A counter that records how many consecutive ' +
            'callbacks have been made in this session.'
        }
      }
    });

    this.dataKey = 'sequence';

    this.evidenceKeyFilter = new BasicListEvidenceKeyFilter([]);
  }

  /**
   * Internal process function for the sequence element
   * Checks if there is a session id and sequence number set
   * if there is it increments the sequence number for that session
   * if not it initialises both. Both values are written to the evidence
   * and to the element data.
   *
   * @param {FlowData} flowData flowData with the evidence in it
   */
  processInternal (flowData) {
    // The session id and the sequence are each read on their own. A value
    // that is not usable counts as absent.
    let sessionId = flowData.evidence.get('query.session-id');
    if (typeof sessionId !== 'string' || sessionId.length === 0) {
      sessionId = crypto.randomBytes(16).toString('hex');
    }

    const given = flowData.evidence.get('query.sequence');
    let sequence = 1;
    if (typeof given === 'number' && Number.isInteger(given)) {
      sequence = given >= 0 && given <= MaxGivenSequence ? given + 1 : 1;
    } else if (typeof given === 'string' && SequencePattern.test(given)) {
      sequence = Number(given) <= MaxGivenSequence ? Number(given) + 1 : 1;
    }

    flowData.evidence.add('query.session-id', sessionId);
    flowData.evidence.add('query.sequence', sequence);

    flowData.setElementData(new ElementDataDictionary({
      flowElement: this,
      contents: { 'session-id': sessionId, sequence }
    }));
  }
}

module.exports = SequenceElement;

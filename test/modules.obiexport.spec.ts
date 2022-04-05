const stars = "\n********************************************************************\n";
const expect = require('chai').expect;
const sinon = require('sinon');
const config = require('config');
import {Logger} from 'healthbotcommon/logger';
const logger = Logger.getInstance();

// Loading and setting relevant dependencies-mocks
// -----------------------------------------------------------

import * as obiConverter from "../modules/obiConverter";

// Test packages definitions
// -----------------------------------------------------------
describe(stars + "HealthBotDashboard > Modules > Obi Export" + stars, () => {
    it('export', () => {
        const adaptiveDialog = obiConverter.convert("1", {steps:[{
            "id": "5da142ae3557-3b3974b2f1d7a8b8-7920",
            "type": "prompt",
            "dataType": "string",
            "designer": {
              "xLocation": 560,
              "yLocation": 88,
              "next": "a303f34acf31-77ff7c8652526b57-c5ff"
            },
            "text": "How are you man?",
            "variable": "your_state",
            "stringId": "stringId_976b7adc07072d53",
            "visible": "${your_state} == null",
            "suggestions": "[\"ok\", \"bad\"]",
            "layout": "vertical"
          },

        ]}, {custom_regexp_recognizers: {}, builtin_regexp_recognizers: {}}, undefined);
        expect(adaptiveDialog.rules.length).to.be.equal(1);
        expect(adaptiveDialog.rules[0].steps.length).to.be.equal(1);
        expect(adaptiveDialog.rules[0].steps[0].$type).to.be.equal("Microsoft.IfCondition");
    });
});

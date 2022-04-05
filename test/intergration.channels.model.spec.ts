var stars = "\n********************************************************************\n";
const expect = require('chai').expect;
const config = require('config');
import {KeyVault} from 'healthbotcommon/keyvault';
import * as msrestAzure from 'ms-rest-azure';
const rp = require('request-promise');
import * as model from "../models/admin-portal-v3/integration/integration.channels.model";
import * as mainModel from "../models/admin-portal-v3/main.model";
import { IAccount } from '../definitions/Request/Account';
import * as auditTrailsLogger from "../services/auditTrailsLogger";
import { tenantContents } from '../modules/globals';
import sinon = require('sinon');


describe(stars + "HealthBotDashboard > Modules > Channels" + stars, () => {

    let  configStub;
    let  kvStub;
    let  msrestStub;
    let  rpStub;
    let  user;
    let  auditStub;
    let  blobService;

    before((done)=>{
        tenantContents.n = {
            // @ts-ignore
            config: {
                load: sinon.stub().returns({ get: sinon.stub(), has: sinon.stub() }),
                getOverrides: sinon.stub().returns({})
            }
        };
        configStub = sinon.stub(config, "get");
        const kv = KeyVault.getInstance();
        kvStub = sinon.stub(kv, "getSecret");
        msrestStub = sinon.stub(msrestAzure,"loginWithServicePrincipalSecretWithAuthResponse");
        rpStub = sinon.stub(rp, 'Request');
        user = {emails: [{
            value: "arie"
        }]}
        auditStub = sinon.stub(auditTrailsLogger,"logChannelChange");
    
        configStub.withArgs('arm_accountPrinciple.clientId').returns('1234');                        
        configStub.withArgs('arm_accountPrinciple.tenantId').returns('1234');                        
        configStub.withArgs('arm_accountPrinciple.subscriptionId').returns('1234');                  
        kvStub.withArgs('arm-principle-password').returns("1234");
        kvStub.withArgs('arm-principle-password').returns("1234");
        
        const creds = new msrestAzure.ApplicationTokenCredentials("1234", "1234", "1234", {});
        
        creds.getToken = (callback) => {
            return callback(null, {tokenType:'Bearer', accessToken:'122', expiresIn:12, expiresOn: "23", resource:""});
        }
        msrestStub.returns({credentials: creds});
        blobService = {
            getUrl: (container, blobName) => {
                return `https://blob.microsoft/${container}/${blobName}`;
            }
        }
        // @ts-ignore
        mainModel.kvService = kv;
        // @ts-ignore
        mainModel.blobService = blobService;            
        done();
    });

    after(()=>{
        configStub.restore();
        kvStub.restore();
        msrestStub.restore();        
        rpStub.restore();
        auditStub.restore();

        delete tenantContents.n;
    })

    it('get all', async () => {        
        rpStub.resolves({value: [{properties: {channelName:'sms', properties: {id:'ok', channelName:'sms'}}}]});
        const result = await model.readChannels({armGroup:'g', name:'n', app_id:'appid'});
        expect(result['sms'].channelName).to.be.equal('sms');
        expect(auditStub.called).to.be.equal(false);
        expect(rpStub.called).to.be.equal(true);
    });
    it('get bot props', async() => {
        rpStub.resolves({value: [{properties: {iconUrl:'iconurl', properties: {id:'ok', channelName:'sms'}}}]});
        const result = await model.readBotProperties({armGroupL:'g', name:'n', app_id:'appid'});
        expect(result.value[0]['properties'].iconUrl).to.be.equal('iconurl');
        expect(auditStub.called).to.be.equal(false);
        expect(rpStub.called).to.be.equal(true);
    });
    it('update iconUrl', async() => {
        rpStub.resolves({value: [{properties: {iconUrl:'iconurl'}}]});
        const account = <IAccount> {armGroup:'g', name:'n', app_id:'appid'};
        const result = await model.updateBotIcon(account, user, 'iconurl', 'file');
        expect(result.value[0].properties.iconUrl).to.be.equal('iconurl');
        expect(auditStub.called).to.be.equal(false);
        expect(rpStub.called).to.be.equal(true);
    });
    it('get', async () => {        
        rpStub.resolves({properties: {properties: {id:'ok'}}});
        const result = await model.getChannel({armGroup:'g', name:'n', app_id:'appid'}, "sms");
        expect(rpStub.called).to.be.equal(true);
        expect(auditStub.called).to.be.equal(false);
        expect(result.app_id).to.be.equal('appid')
    });
    it('add', async () => {        
        rpStub.resolves({properties: {properties: {id:'ok'}}});
        const result = await model.createChannel({}, user, "sms", {});
        expect(rpStub.called).to.be.equal(true);
        expect(auditStub.called).to.be.equal(true);
        expect(result.properties.properties.id).to.be.equal('ok')
    });
    it ('delete', async () => {
        rpStub.resolves({properties: {properties: {id:'ok'}}});
        const result = await model.deleteChannel({ name: "n" }, user, "sms");
        expect(rpStub.called).to.be.equal(true);
        expect(auditStub.called).to.be.equal(true);
        expect(result.properties.properties.id).to.be.equal('ok')
    });
    it ('patch', async () => {
        rpStub.resolves({properties: {properties: {id:'ok'}}});
        const result = await model.modifyChannel({}, user, "sms", {});
        expect(rpStub.called).to.be.equal(true);
        expect(auditStub.called).to.be.equal(true);
        expect(result.properties.properties.id).to.be.equal('ok')
    });    
});

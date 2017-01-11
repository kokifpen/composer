/*
 * IBM Confidential
 * OCO Source Materials
 * IBM Concerto - Blockchain Solution Framework
 * Copyright IBM Corp. 2016
 * The source code for this program is not published or otherwise
 * divested of its trade secrets, irrespective of what has
 * been deposited with the U.S. Copyright Office.
 */

'use strict';

const AccessController = require('../lib/accesscontroller');
const AccessException = require('../lib/accessexception');
const AclFile = require('@ibm/concerto-common').AclFile;
const AclManager = require('@ibm/concerto-common').AclManager;
const Factory = require('@ibm/concerto-common').Factory;
const ModelManager = require('@ibm/concerto-common').ModelManager;

require('chai').should();
const sinon = require('sinon');

describe('AccessController', () => {

    let modelManager;
    let aclManager;
    let factory;
    let asset;
    let participant;
    let controller;

    beforeEach(() => {
        modelManager = new ModelManager();
        modelManager.addModelFile(`
        namespace org.acme.base
        asset BaseAsset {
            o String theValue
        }
        participant BaseParticipant {
            o String theValue
        }`);
        modelManager.addModelFile(`
        namespace org.acme.test
        import org.acme.base.BaseAsset
        import org.acme.base.BaseParticipant
        asset TestAsset identified by assetId extends BaseAsset {
            o String assetId
        }
        asset TestAsset2 identified by assetId extends BaseAsset {
            o String assetId
        }
        participant TestParticipant identified by participantId extends BaseParticipant {
            o String participantId
        }
        participant TestParticipant2 identified by participantId extends BaseParticipant {
            o String participantId
        }`);
        modelManager.addModelFile(`
        namespace org.acme.test2
        import org.acme.base.BaseAsset
        import org.acme.base.BaseParticipant
        asset TestAsset2 identified by assetId extends BaseAsset {
            o String assetId
        }
        participant TestParticipant2 identified by participantId extends BaseParticipant {
            o String participantId
        }`);
        aclManager = new AclManager(modelManager);
        controller = new AccessController(aclManager);
        factory = new Factory(modelManager);
        asset = factory.newInstance('org.acme.test', 'TestAsset', 'A1234');
        participant = factory.newInstance('org.acme.test', 'TestParticipant', 'P5678');
    });

    let setAclFile = (contents) => {
        let aclFile = new AclFile('test.acl', modelManager, contents);
        aclManager.setAclFile(aclFile);
    };

    describe('#check', () => {

        it('should throw if there are no access control rules', () => {
            (() => {
                controller.check(asset, 'READ', participant);
            }).should.throw(AccessException, /does not have/);
        });

        it('should not throw if there is one matching ALLOW access control rule', () => {
            setAclFile('R1 | org.acme.test.TestAsset#A1234 | READ | org.acme.test.TestParticipant#P5678 | (true) | ALLOW | Test R1\n');
            let spy = sinon.spy(controller, 'checkRule');
            controller.check(asset, 'READ', participant);
            sinon.assert.calledOnce(spy);
        });

        it('should throw if there is one matching DENY access control rule', () => {
            setAclFile('R1 | org.acme.test.TestAsset#A1234 | READ | org.acme.test.TestParticipant#P5678 | (true) | DENY | Test R1\n');
            let spy = sinon.spy(controller, 'checkRule');
            (() => {
                controller.check(asset, 'READ', participant);
            }).should.throw(AccessException, /does not have/);
            sinon.assert.calledOnce(spy);
        });

        it('should not throw if there is two non-matching ALLOW access control rules followed by one matching ALLOW access control rule', () => {
            setAclFile(
                'R1 | org.acme.test.TestAsset#A1234 | CREATE | org.acme.test.TestParticipant#P5678 | (true) | ALLOW | Test R1\n' +
                'R1 | org.acme.test.TestAsset#A1234 | UPDATE | org.acme.test.TestParticipant#P5678 | (true) | ALLOW | Test R1\n' +
                'R1 | org.acme.test.TestAsset#A1234 | READ | org.acme.test.TestParticipant#P5678 | (true) | ALLOW | Test R1\n'
            );
            let spy = sinon.spy(controller, 'checkRule');
            controller.check(asset, 'READ', participant);
            sinon.assert.calledThrice(spy);
        });

        it('should not throw if there is two non-matching DENY access control rules followed by one matching ALLOW access control rule', () => {
            setAclFile(
                'R1 | org.acme.test.TestAsset#A1234 | CREATE | org.acme.test.TestParticipant#P5678 | (true) | DENY | Test R1\n' +
                'R1 | org.acme.test.TestAsset#A1234 | UPDATE | org.acme.test.TestParticipant#P5678 | (true) | DENY | Test R1\n' +
                'R1 | org.acme.test.TestAsset#A1234 | READ | org.acme.test.TestParticipant#P5678 | (true) | ALLOW | Test R1\n'
            );
            let spy = sinon.spy(controller, 'checkRule');
            controller.check(asset, 'READ', participant);
            sinon.assert.calledThrice(spy);
        });

        it('should throw if there is two non-matching ALLOW access control rules followed by one matching DENY access control rule', () => {
            setAclFile(
                'R1 | org.acme.test.TestAsset#A1234 | CREATE | org.acme.test.TestParticipant#P5678 | (true) | ALLOW | Test R1\n' +
                'R1 | org.acme.test.TestAsset#A1234 | UPDATE | org.acme.test.TestParticipant#P5678 | (true) | ALLOW | Test R1\n' +
                'R1 | org.acme.test.TestAsset#A1234 | READ | org.acme.test.TestParticipant#P5678 | (true) | DENY | Test R1\n'
            );
            let spy = sinon.spy(controller, 'checkRule');
            (() => {
                controller.check(asset, 'READ', participant);
            }).should.throw(AccessException, /does not have/);
            sinon.assert.calledThrice(spy);
        });

        it('should not throw if there is one matching ALLOW access control rule followed by two non-matching ALLOW access control rules', () => {
            setAclFile(
                'R1 | org.acme.test.TestAsset#A1234 | READ | org.acme.test.TestParticipant#P5678 | (true) | ALLOW | Test R1\n' +
                'R1 | org.acme.test.TestAsset#A1234 | CREATE | org.acme.test.TestParticipant#P5678 | (true) | ALLOW | Test R1\n' +
                'R1 | org.acme.test.TestAsset#A1234 | UPDATE | org.acme.test.TestParticipant#P5678 | (true) | ALLOW | Test R1\n'
            );
            let spy = sinon.spy(controller, 'checkRule');
            controller.check(asset, 'READ', participant);
            sinon.assert.calledOnce(spy);
        });

        it('should not throw if there is one matching ALLOW access control rule followed by two non-matching DENY access control rules', () => {
            setAclFile(
                'R1 | org.acme.test.TestAsset#A1234 | READ | org.acme.test.TestParticipant#P5678 | (true) | ALLOW | Test R1\n' +
                'R1 | org.acme.test.TestAsset#A1234 | CREATE | org.acme.test.TestParticipant#P5678 | (true) | DENY | Test R1\n' +
                'R1 | org.acme.test.TestAsset#A1234 | UPDATE | org.acme.test.TestParticipant#P5678 | (true) | DENY | Test R1\n'
            );
            let spy = sinon.spy(controller, 'checkRule');
            controller.check(asset, 'READ', participant);
            sinon.assert.calledOnce(spy);
        });

        it('should throw if there is one matching DENY access control rule followed by two non-matching ALLOW access control rules', () => {
            setAclFile(
                'R1 | org.acme.test.TestAsset#A1234 | READ | org.acme.test.TestParticipant#P5678 | (true) | DENY | Test R1\n' +
                'R1 | org.acme.test.TestAsset#A1234 | CREATE | org.acme.test.TestParticipant#P5678 | (true) | ALLOW | Test R1\n' +
                'R1 | org.acme.test.TestAsset#A1234 | UPDATE | org.acme.test.TestParticipant#P5678 | (true) | ALLOW | Test R1\n'
            );
            let spy = sinon.spy(controller, 'checkRule');
            (() => {
                controller.check(asset, 'READ', participant);
            }).should.throw(AccessException, /does not have/);
            sinon.assert.calledOnce(spy);
        });

    });

    describe('#checkRule', () => {

        it('should return false if the noun is not matched', () => {
            setAclFile('R1 | org.acme.test.TestAsset#A5678 | READ | org.acme.test.TestParticipant#P5678 | (true) | ALLOW | Test R1\n');
            let spy = sinon.spy(controller, 'matchNoun');
            controller.checkRule(asset, 'READ', participant, aclManager.getAclRules()[0])
                .should.be.false;
            sinon.assert.calledOnce(spy);
        });

        it('should return false if the verb is not matched', () => {
            setAclFile('R1 | org.acme.test.TestAsset#A1234 | READ | org.acme.test.TestParticipant#P5678 | (true) | ALLOW | Test R1\n');
            let spy = sinon.spy(controller, 'matchVerb');
            controller.checkRule(asset, 'CREATE', participant, aclManager.getAclRules()[0])
                .should.be.false;
            sinon.assert.calledOnce(spy);
        });

        it('should return false if the participant is not matched', () => {
            setAclFile('R1 | org.acme.test.TestAsset#A1234 | READ | org.acme.test.TestParticipant#P1234 | (true) | ALLOW | Test R1\n');
            let spy = sinon.spy(controller, 'matchParticipant');
            controller.checkRule(asset, 'READ', participant, aclManager.getAclRules()[0])
                .should.be.false;
            sinon.assert.calledOnce(spy);
        });

        it('should return false if the predicate is not matched', () => {
            setAclFile('R1 | org.acme.test.TestAsset#A1234 | READ | org.acme.test.TestParticipant#P5678 | (false) | ALLOW | Test R1\n');
            let spy = sinon.spy(controller, 'matchPredicate');
            controller.checkRule(asset, 'READ', participant, aclManager.getAclRules()[0])
                .should.be.false;
            sinon.assert.calledOnce(spy);
        });

        it('should return true if the rule matches and ALLOW is specified', () => {
            setAclFile('R1 | org.acme.test.TestAsset#A1234 | READ | org.acme.test.TestParticipant#P5678 | (true) | ALLOW | Test R1\n');
            controller.checkRule(asset, 'READ', participant, aclManager.getAclRules()[0])
                .should.be.true;
        });

        it('should throw if the rule matches and DENY is specified', () => {
            setAclFile('R1 | org.acme.test.TestAsset#A1234 | READ | org.acme.test.TestParticipant#P5678 | (true) | DENY | Test R1\n');
            (() => {
                controller.checkRule(asset, 'READ', participant, aclManager.getAclRules()[0]);
            }).should.throw(AccessException, /does not have/);
        });

    });

    describe('#matchNoun', () => {

        it('should return true if the ACL rule specifies a matching fully qualified identifier', () => {
            setAclFile('R1 | org.acme.test.TestAsset#A1234 | READ | org.acme.test.TestParticipant#P5678 | (true) | ALLOW | Test R1\n');
            controller.matchNoun(asset, aclManager.getAclRules()[0])
                .should.be.true;
        });

        it('should return true if the ACL rule specifies a matching fully qualified name', () => {
            setAclFile('R1 | org.acme.test.TestAsset | READ | org.acme.test.TestParticipant#P5678 | (true) | ALLOW | Test R1\n');
            controller.matchNoun(asset, aclManager.getAclRules()[0])
                .should.be.true;
        });

        it('should return true if the ACL rule specifies a matching namespace', () => {
            setAclFile('R1 | org.acme.test | READ | org.acme.test.TestParticipant#P5678 | (true) | ALLOW | Test R1\n');
            controller.matchNoun(asset, aclManager.getAclRules()[0])
                .should.be.true;
        });

        it('should return false if the ACL rule specifies a non-matching fully qualified identifier', () => {
            setAclFile('R1 | org.acme.test.TestAsset#A5678 | READ | org.acme.test.TestParticipant#P5678 | (true) | ALLOW | Test R1\n');
            controller.matchNoun(asset, aclManager.getAclRules()[0])
                .should.be.false;
        });

        it('should return false if the ACL rule specifies a non-matching fully qualified name', () => {
            setAclFile('R1 | org.acme.test.TestAsset2 | READ | org.acme.test.TestParticipant#P5678 | (true) | ALLOW | Test R1\n');
            controller.matchNoun(asset, aclManager.getAclRules()[0])
                .should.be.false;
        });

        it('should return false if the ACL rule specifies a non-matching namespace', () => {
            setAclFile('R1 | org.acme.test2 | READ | org.acme.test.TestParticipant#P5678 | (true) | ALLOW | Test R1\n');
            controller.matchNoun(asset, aclManager.getAclRules()[0])
                .should.be.false;
        });

    });

    describe('#matchVerb', () => {

        ['CREATE', 'READ', 'UPDATE', 'DELETE'].forEach((verb) => {

            it(`should return true for ${verb} if the ACL rule specifies ALL`, () => {
                setAclFile('R1 | org.acme.test.TestAsset#A1234 | ALL | org.acme.test.TestParticipant#P5678 | (true) | ALLOW | Test R1\n');
                controller.matchVerb(verb, aclManager.getAclRules()[0])
                    .should.be.true;
            });

            it(`should return true for ${verb} if the ACL rule specifies ${verb}`, () => {
                setAclFile(`R1 | org.acme.test.TestAsset#A1234 | ${verb} | org.acme.test.TestParticipant#P5678 | (true) | ALLOW | Test R1\n`);
                controller.matchVerb(verb, aclManager.getAclRules()[0])
                    .should.be.true;
            });

            it(`should return false for ${verb} if the ACL rule specifies something else`, () => {
                setAclFile(`R1 | org.acme.test.TestAsset#A1234 | ${verb === 'READ' ? 'CREATE' : 'READ'} | org.acme.test.TestParticipant#P5678 | (true) | ALLOW | Test R1\n`);
                controller.matchVerb(verb, aclManager.getAclRules()[0])
                    .should.be.false;
            });

        });

    });

    describe('#matchParticipant', () => {

        it('should return true if the ACL rule specifies ANY participant', () => {
            setAclFile('R1 | org.acme.test.TestAsset#A1234 | READ | ANY | (true) | ALLOW | Test R1\n');
            controller.matchParticipant(participant, aclManager.getAclRules()[0])
                .should.be.true;
        });

        it('should return true if the ACL rule specifies a matching fully qualified identifier', () => {
            setAclFile('R1 | org.acme.test.TestAsset#A1234 | READ | org.acme.test.TestParticipant#P5678 | (true) | ALLOW | Test R1\n');
            controller.matchParticipant(participant, aclManager.getAclRules()[0])
                .should.be.true;
        });

        it('should return true if the ACL rule specifies a matching fully qualified name', () => {
            setAclFile('R1 | org.acme.test.TestAsset#A1234 | READ | org.acme.test.TestParticipant | (true) | ALLOW | Test R1\n');
            controller.matchParticipant(participant, aclManager.getAclRules()[0])
                .should.be.true;
        });

        it('should return true if the ACL rule specifies a matching namespace', () => {
            setAclFile('R1 | org.acme.test.TestAsset#A1234 | READ | org.acme.test | (true) | ALLOW | Test R1\n');
            controller.matchParticipant(participant, aclManager.getAclRules()[0])
                .should.be.true;
        });

        it('should return false if the ACL rule specifies a non-matching fully qualified identifier', () => {
            setAclFile('R1 | org.acme.test.TestAsset#A1234 | READ | org.acme.test.TestParticipant#P1234 | (true) | ALLOW | Test R1\n');
            controller.matchParticipant(participant, aclManager.getAclRules()[0])
                .should.be.false;
        });

        it('should return false if the ACL rule specifies a non-matching fully qualified name', () => {
            setAclFile('R1 | org.acme.test.TestAsset#A1234 | READ | org.acme.test.TestParticipant2 | (true) | ALLOW | Test R1\n');
            controller.matchParticipant(participant, aclManager.getAclRules()[0])
                .should.be.false;
        });

        it('should return false if the ACL rule specifies a non-matching namespace', () => {
            setAclFile('R1 | org.acme.test.TestAsset#A1234 | READ | org.acme.test2 | (true) | ALLOW | Test R1\n');
            controller.matchParticipant(participant, aclManager.getAclRules()[0])
                .should.be.false;
        });

    });

    describe('#natchPredicate', () => {

        it('should return true if the ACL rule specifies a predicate of (true)', () => {
            setAclFile('R1 | org.acme.test.TestAsset#A1234 | READ | ANY | (true) | ALLOW | Test R1\n');
            controller.matchPredicate(asset, 'READ', participant, aclManager.getAclRules()[0])
                .should.be.true;
        });

        it('should return false if the ACL rule specifies a predicate of (false)', () => {
            setAclFile('R1 | org.acme.test.TestAsset#A1234 | READ | ANY | (false) | ALLOW | Test R1\n');
            controller.matchPredicate(asset, 'READ', participant, aclManager.getAclRules()[0])
                .should.be.false;
        });

        it('should return true if the ACL rule specifies a predicate that returns a truthy expression', () => {
            setAclFile('R1 | org.acme.test.TestAsset#A1234 | READ | ANY | ((3 + 6) / 3 === 3) | ALLOW | Test R1\n');
            controller.matchPredicate(asset, 'READ', participant, aclManager.getAclRules()[0])
                .should.be.true;
        });

        it('should return false if the ACL rule specifies a predicate that returns a falsey expression', () => {
            setAclFile('R1 | org.acme.test.TestAsset#A1234 | READ | ANY | ((3 + 3) / 3 === 3) | ALLOW | Test R1\n');
            controller.matchPredicate(asset, 'READ', participant, aclManager.getAclRules()[0])
                .should.be.false;
        });

        it('should return true if the ACL rule specifies a predicate that accesses the bound resource and returns a truthy expression', () => {
            setAclFile('R1 | org.acme.test.TestAsset#A1234:asset | READ | ANY | (asset.getFullyQualifiedIdentifier() === \'org.acme.test.TestAsset#A1234\') | ALLOW | Test R1\n');
            controller.matchPredicate(asset, 'READ', participant, aclManager.getAclRules()[0])
                .should.be.true;
        });

        it('should return false if the ACL rule specifies a predicate that accesses the bound resource and returns a falsey expression', () => {
            setAclFile('R1 | org.acme.test.TestAsset#A1234:asset | READ | ANY | (asset.getFullyQualifiedIdentifier() !== \'org.acme.test.TestAsset#A1234\') | ALLOW | Test R1\n');
            controller.matchPredicate(asset, 'READ', participant, aclManager.getAclRules()[0])
                .should.be.false;
        });

        it('should return true if the ACL rule specifies a predicate that accesses the bound participant and returns a truthy expression', () => {
            setAclFile('R1 | org.acme.test.TestAsset#A1234 | READ | org.acme.test.TestParticipant:participant | (participant.getFullyQualifiedIdentifier() === \'org.acme.test.TestParticipant#P5678\') | ALLOW | Test R1\n');
            controller.matchPredicate(asset, 'READ', participant, aclManager.getAclRules()[0])
                .should.be.true;
        });

        it('should return false if the ACL rule specifies a predicate that accesses the bound participant and returns a falsey expression', () => {
            setAclFile('R1 | org.acme.test.TestAsset#A1234 | READ | org.acme.test.TestParticipant:participant | (participant.getFullyQualifiedIdentifier() !== \'org.acme.test.TestParticipant#P5678\') | ALLOW | Test R1\n');
            controller.matchPredicate(asset, 'READ', participant, aclManager.getAclRules()[0])
                .should.be.false;
        });

        it('should return true if the ACL rule specifies a predicate that accesses the bound resource and participant and returns a truthy expression', () => {
            setAclFile('R1 | org.acme.test.TestAsset#A1234:asset | READ | org.acme.test.TestParticipant:participant | (asset.getFullyQualifiedIdentifier() !== participant.getFullyQualifiedIdentifier()) | ALLOW | Test R1\n');
            controller.matchPredicate(asset, 'READ', participant, aclManager.getAclRules()[0])
                .should.be.true;
        });

        it('should return false if the ACL rule specifies a predicate that accesses the bound resource and participant and returns a falsey expression', () => {
            setAclFile('R1 | org.acme.test.TestAsset#A1234:asset | READ | org.acme.test.TestParticipant:participant | (asset.getFullyQualifiedIdentifier() === participant.getFullyQualifiedIdentifier()) | ALLOW | Test R1\n');
            controller.matchPredicate(asset, 'READ', participant, aclManager.getAclRules()[0])
                .should.be.false;
        });

        it('should throw if the ACL rule specifies a predicate that is faulty and causes an exception to be thrown', () => {
            setAclFile('R1 | org.acme.test.TestAsset#A1234:asset | READ | ANY | (asset.not.a.real.property = {}) | ALLOW | Test R1\n');
            (() => {
                controller.matchPredicate(asset, 'READ', participant, aclManager.getAclRules()[0]);
            }).should.throw(AccessException, /does not have/);
        });

    });

});
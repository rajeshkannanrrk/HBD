import * as mainModel from "../../../models/admin-portal-v3/main.model";
import {router as conversationSpellingController} from "./conversation/configuration.conversation.spelling.ctrl";
import {router as conversationHandoffController} from "./conversation/configuration.conversation.handoff.ctrl";
import {router as conversationInteractionsController} from "./conversation/configuration.conversation.interactions.ctrl";
import {router as conversationNavigationController} from "./conversation/configuration.conversation.navigation.ctrl";
const express = require('express');

export const router = express.Router();

router.use((req, res, next) => {
    req._navigation_path.push("conversation");
    next();
});

router.get('/', async (req, res) => {
    try {
        const data: any  = await mainModel.getData(req);
        res.render('admin-portal-v3/configuration/configuration.conversation.ejs', data);
    }
    catch (error) {
        mainModel.pageNotFound(req, res, error);
    }
});

router.use('/spelling', conversationSpellingController);
router.use('/interactions', conversationInteractionsController);
router.use('/navigation', conversationNavigationController);
router.use('/handoff', conversationHandoffController);

router.use((req, res) => {
    mainModel.pageNotFound(req, res);
});

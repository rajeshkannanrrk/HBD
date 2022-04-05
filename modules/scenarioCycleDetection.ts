import {Logger} from 'healthbotcommon/logger';
import {ScenarioError, ScenarioErrorSeverity} from "../models/admin-portal-v3/scenarios/scenarios.manage.model";

const uuid = require('node-uuid');
const logger = Logger.getInstance();

export async function validateScenarioCircularity(name, scenario, loadSubScenarioFunc) {
    if (scenario.hasOwnProperty('steps') && scenario.steps.length > 0) {
        scenario.name = name;
        const scenarioSearch = new ScenarioSearch(scenario, loadSubScenarioFunc);
        await scenarioSearch.resolveSubScenarios();
        if (!await scenarioSearch.isScenarioFreeOfInvalidCycles()) {
            logger.error(null, "Scenario '%s' has invalid cycles. returning warning", name);
            throw new ScenarioError("Scenario has invalid cycles (with no active Prompt or Data Source steps)", ScenarioErrorSeverity.warning, scenarioSearch.invalidCycleStartStep.id);
        }
    }
    return true;
}

class ScenarioSearch {

    public invalidCycleStartStep;

    private scenario;
    private scenarioStepMap;

    private stepStackSize: number;
    private stepStack;
    private stepStackMap;
    private stepVisited;

    private scenarioStackSize: number;
    private scenarioStack;
    private scenarioMap;
    private scenarioCache;

    private loadSubScenarioFunc;

    public constructor(scenario, loadSubScenarioFunc) {
        this.scenario = scenario;
        this.scenarioStepMap = {};
        this.mapSteps(scenario.steps);

        this.stepStackSize = 0;
        this.stepStack = {};
        this.stepStackMap = {};
        this.stepVisited = {};

        this.scenarioStackSize = 0;
        this.scenarioStack = {};
        this.scenarioMap = {};
        this.scenarioCache = {};

        this.loadSubScenarioFunc = loadSubScenarioFunc;
    }

    public async isScenarioFreeOfInvalidCycles(): Promise<boolean> {
        return this.dfsIsScenarioFreeOfInvalidCycles(this.scenario.steps[0]);
    }

    public async resolveSubScenarios() {
        // push top level scenario to scenarioStack
        this.pushScenario(this.scenario.name, this.scenario.steps[0]);

        logger.debug(null, "before resolving sub scenarios, scenario '%s' contains %d steps", this.scenario.name, this.scenario.steps.length);
        await this.dfsResolveSubScenarios(this.scenario.steps[0]);
    }

    private waitForNextEventLoop() {
        return new Promise<void>((resolve, reject) => {
            setTimeout(() => resolve(), 0);
        });
    }

    /**
     * This algorithm returns true iff the directed graph with root $step contains a a cycle without prompt or data source step (a.k.a invalid cycle).
     * We denote a node as "checked" iff the sub graph which its root is the node was checked by the algorithm.
     * In case we encounter a "checked" node, we don't proceed through this node anymore, since it has already been checked (and if there was an
     * invalid cycle going through one of the nodes of this subtree, we would have found it earlier).
     * Sketch of proof of correctness - by induction on graph size:
     * Base case: trivial.
     * Inductive step: Let v be the start node of the graph, with children v_1,...,v_k. For 1<=i<=k:
     * If v_i has an outgoing back edge (i.e. there is a cycle), so if it doesn't include a prompt/data connection node, then we will count it as a cycle (when
     * we check the step stack). If it does include a prompt/data connection node, we won't count it as a cycle (due to stepValidatesCycle(...) call).
     * if v_i doesn't have a back edge (to the node v or a previous node), then sub-graph with v_i as start node is smaller then our graph,
     * therefore by induction hypothesis the algorithm works.
     */
    private async dfsIsScenarioFreeOfInvalidCycles(step): Promise<boolean> {
        if (step.checked) {
            return true;
        }
        await this.waitForNextEventLoop();
        const depth = this.pushStep(step);
        let subTreeResult = true;
        const nextSteps = this.getNextSteps(step);
        for (const child of nextSteps) {
            const childStackLocation = this.stepStackLocation(child);
            if (childStackLocation > 0) {
                // found a cycle, check if it contains an 'active' prompt step
                let validCycle = false;
                for (let k = childStackLocation; k <= depth; k++) {
                    const v = this.stepStack[k];
                    if (this.stepValidatesCycle(v)) {
                        // cycle contains an active prompt or datasource step, i.e. cycle is valid, stop iterating it, continue dfs
                        validCycle = true;
                        break;
                    }
                }
                if (!validCycle) {
                    // remember where cycles starts and ends
                    this.invalidCycleStartStep = child;
                }
                subTreeResult = validCycle;
            }
            else {
                subTreeResult = subTreeResult && await this.dfsIsScenarioFreeOfInvalidCycles(child);
            }
            if (!subTreeResult) {
                // found invalid cycle, stop dfs
                break;
            }
        }
        this.popStep();
        step.checked = true;
        return subTreeResult;
    }

    private async dfsResolveSubScenarios(step) {
        this.setVisited(step);
        let result;
        if (step.type === "beginScenario" || step.type === "replaceScenario") {
            logger.debug(null, "resolving %s '%s'", step.type, step.scenario);
            result = await this.resolveSubScenario(step);
            if (result.recursive) {
                logger.debug(null, "sub scenario '%s' is already found in scenario stack, just added a pointer to it", step.scenario);
                // no need to push scenario to stack
            }
            else {
                this.pushScenario(step.scenario, result.firstStep);
                logger.debug(null, "after resolving sub scenario '%s', scenario '%s' contains %d steps", step.scenario, this.scenario.name, this.scenario.steps.length);
            }
        }
        const nextSteps = this.getNextSteps(step);
        for (let i = 0; i < nextSteps.length; i++) {
            const child = nextSteps[i];
            if (!this.isVisited(child)) {
                await this.dfsResolveSubScenarios(child);
            }
        }
        if ((step.type === "beginScenario" || step.type === "replaceScenario") && !result.recursive) {
            this.popScenario();
        }
    }

    // step walk private methods

    private mapSteps(steps) {
        steps.forEach((step) => {
            this.scenarioStepMap[step.id] = step;
        });
    }
    private pushStep(step): number {
        const size = ++this.stepStackSize;
        this.stepStack[size] = step;
        this.stepStackMap[step.id] = size;
        return size;
    }

    private popStep() {
        let deletedStep;

        if (this.stepStackSize > 0) {
            deletedStep = this.stepStack[this.stepStackSize];
            delete this.stepStack[this.stepStackSize];
            delete this.stepStackMap[deletedStep.id];
            this.stepStackSize--;

            return deletedStep;
        }
    }

    private setVisited(step) {
        this.stepVisited[step.id] = true;
    }

    private isVisited(step) {
        return this.stepVisited[step.id] !== undefined;
    }

    private stepStackLocation(step): number {
        return this.stepStackMap[step.id] ? this.stepStackMap[step.id] : -1;
    }

    private getNextSteps(step) {
        const ids: Set<string> = new Set<string>();
        if (step.designer.hasOwnProperty('next')) {
            ids.add(step.designer.next);
        }
        if (step.designer.hasOwnProperty('errorStepId')) {
            ids.add(step.designer.errorStepId);
        }
        if (step.hasOwnProperty('targetStepId')) {
            ids.add(step.targetStepId);
        }
        if (step.hasOwnProperty('cases')) {
            step.cases.forEach((c) => {
                ids.add(c.targetStepId);
            });
        }

        return Array.from(ids).map((id) => this.scenarioStepMap[id]).filter((nextStep) => nextStep);
    }

    private stepValidatesCycle(step): boolean {
        switch (step.type) {
            case "prompt":
            case "yesnoprompt":
            case "datasource":
            case "wait":
                return !step.hasOwnProperty('visible') ||
                    step.visible === true ||
                    (typeof(step.visible) === 'string' && step.visible.trim() === 'true');
            default:
                return false;
        }
    }

    // scenario walk private methods

    private pushScenario(scenarioName, firstStep) {
        const size = ++this.scenarioStackSize;
        this.scenarioStack[size] = scenarioName;
        this.scenarioMap[scenarioName] = firstStep;
    }

    private popScenario() {
        let deletedScenario;

        if (this.scenarioStackSize > 0) {
            deletedScenario = this.scenarioStack[this.scenarioStackSize];
            delete this.scenarioStack[this.scenarioStackSize];
            delete this.scenarioMap[deletedScenario];
            this.scenarioStackSize--;

            return deletedScenario;
        }
    }

    private findScenario(scenarioName) {
        return this.scenarioMap[scenarioName];
    }

    private async resolveSubScenario(step) {
        const scenarioName = step.scenario;
        let isRecursive = true;
        // check if scenario is in scenario stack and get its first step
        let next = this.findScenario(scenarioName);
        if (!next) {
            // scenario is not yet resolved.
            isRecursive = false;
            // load scenario
            const scenario = await this.loadSubScenario(scenarioName);
            // add special 'out' step
            const outStep = {
                id: uuid.v4(),
                type: "out",
                designer: {
                    // connect 'out' step to 'begin/replace scenario' step's next
                    // 'begin/replace scenario' step's next could be either a real step in the containing scenario or a pointer to an out step in case it's a leaf in a sub scenario
                    next: step.designer.next ? step.designer.next : step.targetStepId
                },
            };
            delete step.designer.next;
            delete step.targetStepId;
            // as there can be multiple resolutions of the same scenario, manipulate the step ids to differentiate (concat the 'begin/replace scenario' step id)
            // + connect all sub scenario leaves to out step
            scenario.steps.forEach((newStep) => {
                let leaf = true;
                newStep.id = newStep.id + "_" + step.id;
                if (newStep.hasOwnProperty('designer') && newStep.designer.hasOwnProperty('next')) {
                    newStep.designer.next = newStep.designer.next + "_" + step.id;
                    leaf = false;
                }
                if (newStep.hasOwnProperty('targetStepId')) {
                    newStep.targetStepId = newStep.targetStepId + "_" + step.id;
                    leaf = false;
                }
                if (newStep.hasOwnProperty('designer') && newStep.designer.hasOwnProperty('errorStepId')) {
                    newStep.designer.errorStepId = newStep.designer.errorStepId + "_" + step.id;
                    leaf = false;
                }
                if (newStep.hasOwnProperty('cases')) {
                    newStep.cases.forEach((c) => {
                        c.targetStepId = c.targetStepId + "_" + step.id;
                        leaf = false;
                    });
                }
                if (leaf) {
                    // this is a leaf. connect it to out step
                    newStep.targetStepId = outStep.id;
                }
            });
            scenario.steps.push(outStep);
            // add steps to top level scenario
            this.scenario.steps = this.scenario.steps.concat(scenario.steps);
            this.mapSteps(scenario.steps);
            next = scenario.steps[0];
        }
        // point step to sub scenario first step
        // (not setting step.designer.next as it may be populated already)
        step.targetStepId = next.id;
        return { firstStep: next, recursive: isRecursive };
    }

    private async loadSubScenario(scenarioName) {
        // check if scenario code is cached (not caching parsed object, so that a new clone is served each time)
        let jsonCode = this.scenarioCache[scenarioName];
        if (!jsonCode) {
            jsonCode = await this.loadSubScenarioFunc(scenarioName);
            // cache scenario code text
            this.scenarioCache[scenarioName] = jsonCode;
        }
        try {
            const code = JSON.parse(jsonCode);
            code.name = scenarioName;
            return code;
        } catch (e) {
            throw new Error("failed to parse json code of scenario '" + scenarioName + "'. Error: " + e.message);
        }
    }
}

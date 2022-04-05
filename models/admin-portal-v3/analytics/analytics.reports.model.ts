import * as mainModel from "../main.model";
const config = require('config');
const moment = require('moment');
const rp = require('request-promise');

export enum Mode {
    HOURS = "hours",
    DAYS = "days",
    MONTHS = "months"
}

async function executeQuery(q) {
    const options = {
        uri: "https://api.applicationinsights.io/v1/apps/" + config.get("application_insights.bot_application_id") + "/query",
        qs: { query: q },
        headers: { "x-api-key": await mainModel.kvService.getSecret("dashboardreportsapikey"), "Prefer": "wait=600" },
        json: true
    };
    return rp(options);
}

export async function uniqueUsers(accountName: string, mode: Mode, fromTime: string, toTime: string) {
    let q = `customEvents | where timestamp >= todatetime("${fromTime}") and timestamp < todatetime("${toTime}") and 
    name in ("ScenarioOccurrence", "TopLevelUtterance", "BuiltinDialogOccurrence") and customDimensions["tenantName"] == "${accountName}" `;
    if (mode === Mode.HOURS) {
        q += ` | summarize count() by bin(timestamp, 1h), user=tostring(customDimensions["user_id"]), label="Unique users"`;
        q += ` | summarize count() by timestamp, label`;
        q += ` | make-series sum(count_) default=0 on timestamp in range(todatetime("${fromTime}"), todatetime("${toTime}"), 1h) by label`;
    }
    else if (mode === Mode.DAYS) {
        q += ` | summarize count() by bin(timestamp, 1d), user=tostring(customDimensions["user_id"]), label="Unique users"`;
        q += ` | summarize count() by timestamp, label`;
        q += ` | make-series sum(count_) default=0 on timestamp in range(todatetime("${fromTime}"), todatetime("${toTime}"), 1d) by label`;
    }
    else if (mode === Mode.MONTHS) {
        q += ` | summarize count() by month=startofmonth(timestamp), user=tostring(customDimensions["user_id"]), label="Unique users"`;
        q += ` | summarize count() by month, label`;
    }
    const data = await executeQuery(q);
    return processReportByTime(data, mode, fromTime, toTime);
}

export async function messages(accountName: string, mode: Mode, fromTime: string, toTime: string, top: number) {
    let q = `customEvents | where customDimensions["tenantName"] == "${accountName}" and timestamp >= todatetime("${fromTime}") and timestamp < todatetime("${toTime}")`;
    q += ' and name in ("Message")';
    if (mode === Mode.HOURS) {
        q += ` | summarize count() by bin(timestamp, 1h), label=tostring(customDimensions["speaker"])`;
        q += ` | make-series sum(count_) default=0 on timestamp in range(todatetime("${fromTime}"), todatetime("${toTime}"), 1h) by label`;
    }
    else if (mode === Mode.DAYS) {
        q += ` | summarize count() by bin(timestamp, 1d), label=tostring(customDimensions["speaker"])`;
        q += ` | make-series sum(count_) default=0 on timestamp in range(todatetime("${fromTime}"), todatetime("${toTime}"), 1d) by label`;
    }
    else if (mode === Mode.MONTHS) {
        q += ` | summarize count() by month=startofmonth(timestamp), label=tostring(customDimensions["speaker"])`;
    }
    const data = await executeQuery(q);
    const result = processReportByTime(data, mode, fromTime, toTime, top);
    if (result.datasets.length > 0) {
        const bot = {
            stack: "m",
            label: "Bot",
            data: new Array(result.datasets[0].data.length).fill(0)
        };
        const user = {
            stack: "m",
            label: "User",
            data: new Array(result.datasets[0].data.length).fill(0)
        };
        for (const ds of result.datasets) {
            if (ds.label !== "Bot" && ds.label !== "User") {
                bot.label = ds.label;
            }
            for (let i = 0; i < ds.data.length; i++) {
                if (ds.label === "User") {
                    user.data[i] += ds.data[i];
                }
                else {
                    bot.data[i] += ds.data[i];
                }
            }
        }
        result.datasets = [bot, user];
    }

    return result;
}

export async function builtinScenariosSessions(accountName: string, mode: Mode, fromTime: string, toTime: string, top: number) {
    let q = `customEvents | where customDimensions["tenantName"] == "${accountName}" and timestamp >= todatetime("${fromTime}") and timestamp < todatetime("${toTime}")`;
    q += ' and name in ("BuiltinDialogOccurrence", "TriageOccurence")';
    if (mode === Mode.HOURS) {
        q += ` | summarize count() by bin(timestamp, 1h), label=tostring(customDimensions["dialogName"])`;
        q += ` | make-series sum(count_) default=0 on timestamp in range(todatetime("${fromTime}"), todatetime("${toTime}"), 1h) by label`;
    }
    else if (mode === Mode.DAYS) {
        q += ` | summarize count() by bin(timestamp, 1d), label=tostring(customDimensions["dialogName"])`;
        q += ` | make-series sum(count_) default=0 on timestamp in range(todatetime("${fromTime}"), todatetime("${toTime}"), 1d) by label`;
    }
    else if (mode === Mode.MONTHS) {
        q += ` | summarize count() by month=startofmonth(timestamp), label=tostring(customDimensions["dialogName"])`;
    }
    const data = await executeQuery(q);
    return processReportByTime(data, mode, fromTime, toTime, top);
}

export async function customScenarioCompletion(accountName: string, mode: Mode, fromTime: string, toTime: string, top: number) {
    let q = `customEvents | where customDimensions["tenantName"] == "${accountName}" and timestamp >= todatetime("${fromTime}") and timestamp < todatetime("${toTime}")`;
    q += ' | where name in ("ScenarioStart", "ScenarioEnded") and customDimensions.programmaticOutcome <> true';
    q += ` | project timestamp, name, scenarioName=customDimensions.dialogName | summarize count() by name, label=tostring(scenarioName)`;
    const data = await executeQuery(q);
    const rows = data.tables[0].rows;
    const results: Map<string, {started: number; outcomes: number; ended: number}> = new Map();
    for (const [eventType, scenarioName, startCount] of rows.filter((r) => r[0] === "ScenarioStart")) {
        results.set(scenarioName, {started: startCount, outcomes: 0, ended: 0});
    }
    for (const [eventType, scenarioName, endCount] of rows.filter((r) => r[0] === "ScenarioEnded")) {
        if (results.has(scenarioName)) {
            results.get(scenarioName).ended = endCount;
        }
    }
    return [...results.entries()]
        .map(([name, counters]) => ({
            ...counters,
            name: name.replace("/scenarios/", ""),
            endedRate: (Math.floor(100 * (100 * counters.ended / counters.started))) / 100
        }));
}

export async function customScenariosSessions(accountName: string, mode: Mode, fromTime: string, toTime: string, top: number) {
    let q = `customEvents | where customDimensions["tenantName"] == "${accountName}" and timestamp >= todatetime("${fromTime}") and timestamp < todatetime("${toTime}")`;
    q += ' and name in ("ScenarioStart")';
    if (mode === Mode.HOURS) {
        q += ` | summarize count() by bin(timestamp, 1h), label=tostring(customDimensions["dialogName"])`;
        q += ` | make-series sum(count_) default=0 on timestamp in range(todatetime("${fromTime}"), todatetime("${toTime}"), 1h) by label`;
    }
    else if (mode === Mode.DAYS) {
        q += ` | summarize count() by bin(timestamp, 1d), label=tostring(customDimensions["dialogName"])`;
        q += ` | make-series sum(count_) default=0 on timestamp in range(todatetime("${fromTime}"), todatetime("${toTime}"), 1d) by label`;
    }
    else if (mode === Mode.MONTHS) {
        q += ` | summarize count() by month=startofmonth(timestamp), label=tostring(customDimensions["dialogName"])`;
    }
    const data = await executeQuery(q);
    const result = processReportByTime(data, mode, fromTime, toTime, top);
    result.datasets.forEach((ds) => {
        ds.label = ds.label.replace("/scenarios/", "");
    });
    return result;
}

export async function customScenariosOutcomes(accountName: string, mode: Mode, fromTime: string, toTime: string, top: number) {
    let q = `customEvents | where customDimensions["tenantName"] == "${accountName}" and timestamp >= todatetime("${fromTime}") and timestamp < todatetime("${toTime}")`;
    q += ' and name in ("ScenarioOutcome")';
    if (mode === Mode.HOURS) {
        q += ` | summarize count() by bin(timestamp, 1h), label=tostring(customDimensions["dialogOutcome"])`;
        q += ` | make-series sum(count_) default=0 on timestamp in range(todatetime("${fromTime}"), todatetime("${toTime}"), 1h) by label`;
    }
    else if (mode === Mode.DAYS) {
        q += ` | summarize count() by bin(timestamp, 1d), label=tostring(customDimensions["dialogOutcome"])`;
        q += ` | make-series sum(count_) default=0 on timestamp in range(todatetime("${fromTime}"), todatetime("${toTime}"), 1d) by label`;
    }
    else if (mode === Mode.MONTHS) {
        q += ` | summarize count() by month=startofmonth(timestamp), label=tostring(customDimensions["dialogOutcome"])`;
    }
    const data = await executeQuery(q);

    const result = processReportByTime(data, mode, fromTime, toTime, top);
    result.datasets.forEach((ds) => {
        ds.label = ds.label.replace("/scenarios/", "");
    });
    return result;
}
// todo get from strings.json
function getScoreTextById(id: FeedbackScore) {
    switch (id) {
        case FeedbackScore.csf5:
            return 'Very satisfied';
        case FeedbackScore.csf4:
            return 'Somewhat satisfied';
        case FeedbackScore.csf3:
            return 'Not satisfied not dissatisfied';
        case FeedbackScore.csf2:
            return 'Somewhat dissatisfied';
        case FeedbackScore.csf1:
            return 'Very dissatisfied';
        default:
            throw new Error("val " + id + " is not valid");
    }
}

export enum FeedbackScore {
    csf1 = 1, // not satisfied
    csf2 = 2,
    csf3 = 3,
    csf4 = 4,
    csf5 = 5 // very satisfied
}

function getFeedbackQueryString(accountName: string, mode: Mode, fromTime: string, toTime: string) {
    let q = `customEvents | where customDimensions["tenantName"] == "${accountName}" and timestamp >= todatetime("${fromTime}") and timestamp < todatetime("${toTime}")`;
    q += ' and name in ("' + "FeedbackEvent" + '")';
    if (mode === Mode.HOURS) {
        q += ` | summarize count () by bin(timestamp, 1h), label=toint(customDimensions.feedbackScore)`;
        q += ` | make-series sum(count_) default=0 on timestamp in range(todatetime("${fromTime}"), todatetime("${toTime}"), 1h) by label`;
    }
    else if (mode === Mode.DAYS) {
        q += ` | summarize count () by bin(timestamp, 1d), label=toint(customDimensions.feedbackScore)`;
        q += ` | make-series sum(count_) default=0 on timestamp in range(todatetime("${fromTime}"), todatetime("${toTime}"), 1d) by label`;
    }
    else if (mode === Mode.MONTHS) {
        q += ` | summarize count() by month=startofmonth(timestamp), label=toint(customDimensions.feedbackScore)`;
    }
    return q;
}

function getNsatFeedbackScore(s5: number, s2: number, s1: number, total: number) {
    return Math.round((100 + 100 * (s5 - s2 - s1) / total));
}

function getAvgFeedbackScore(sum: number, total: number) {
    return Math.round(100 * sum / total) / 100;
}

export async function feedbacksScore(accountName: string, mode: Mode, fromTime: string, toTime: string) {
    const q = getFeedbackQueryString(accountName, mode, fromTime, toTime);
    const data = await executeQuery(q);
    if (data.tables[0].rows.length === 0) {
        return {
            labels: [],
            datasets: []
        };
    }
    const cleanData = processReportByTime(data, mode, fromTime, toTime);

    const dataLen = cleanData.labels.length;
    let score5Counts = Array(dataLen).fill(0);
    let score1Counts = Array(dataLen).fill(0);
    let score2Counts = Array(dataLen).fill(0);
    let scoreCounts = Array(dataLen).fill(0);
    let scoreSums = Array(dataLen).fill(0);

    cleanData.datasets.forEach((ds) => {
        const feedbackScore: number = +ds.label;

        if (feedbackScore === FeedbackScore.csf5) {
            score5Counts = ds.data;
        }
        else if (feedbackScore === FeedbackScore.csf1) {
            score1Counts = ds.data;
        }
        else if (feedbackScore === FeedbackScore.csf2) {
            score2Counts = ds.data;
        }

        scoreSums = scoreSums.map((val, index) => val + feedbackScore * ds.data[index]);
        scoreCounts = scoreCounts.map((val, index) => val + ds.data[index]);
    });

    function sum(arr: any[]) {
        return arr.reduce((a, b) => a + b, 0);
    }

    const score5TotalCount = sum(score5Counts);
    const score2TotalCount = sum(score2Counts);
    const score1TotalCount = sum(score1Counts);
    const scoreTotalCount = sum(scoreCounts);
    const scoreTotalSums = sum(scoreSums);

    const totalNsat =   scoreTotalCount === 0 ?
        undefined :
        getNsatFeedbackScore(score5TotalCount, score2TotalCount, score1TotalCount, scoreTotalCount);

    const totalAvgCsat =    scoreTotalCount === 0 ?
        undefined :
        getAvgFeedbackScore(scoreTotalSums, scoreTotalCount);

    const nsatScoreText = totalNsat === undefined ? null : "NSAT: " + totalNsat;
    const avgCsatScoreText = totalAvgCsat === undefined ? null : "AVG CSAT: " + totalAvgCsat;

    const nsatData = score5Counts.map((val, index) => {
        const score5 = val;
        const score2 = score2Counts[index];
        const score1 = score1Counts[index];
        const scoreCount = scoreCounts[index];

        if (scoreCount === 0) {
            return 0;
        }
        return getNsatFeedbackScore(score5, score2, score1, scoreCount);
    });

    // avg csat for each period
    const avgData = scoreSums.map((val, index) => {
        const scoreSum = val;
        const scoreCount = scoreCounts[index];

        if (scoreCount === 0) {
            return 0;
        }

        return getAvgFeedbackScore(scoreSum, scoreCount);
    });


    const rightAxisValue = {
        minValue: 0,
        maxValue: 200,
        valuePostfix: "",
        label: "NSAT"
    };

    const leftAxisValue = {
        minValue: 0,
        maxValue: 5,
        valuePostfix: "",
        label: "AVG CSAT"
    };

    const result = {
        labels: cleanData.labels,
        datasets: [
            {
                label: "NSAT",
                data: nsatData
            },
            {
                label: "AVG CSAT",
                data: avgData
            }
        ],
        summary: null,
        rightTitleText1: nsatScoreText,
        rightTitleText2: avgCsatScoreText,
        rightAxis: rightAxisValue,
        leftAxis: leftAxisValue
    };

    return result;
}

export async function feedbacksDistribution(accountName: string, mode: Mode, fromTime: string, toTime: string, top: number) {
    const q = getFeedbackQueryString(accountName, mode, fromTime, toTime);
    const data = await executeQuery(q);

    const result = processReportByTime(data, mode, fromTime, toTime, top);

    const exists = new Set();

    result.datasets.forEach((ds) => {
        exists.add(+ds.label);
    });

    if (exists.size > 0) {
        for (let score = FeedbackScore.csf1; score <= FeedbackScore.csf5; score++) {
            if (!exists.has(score)) {
                const ds = {
                    stack: "m",
                    label: score,
                    data: Array(result.labels.length).fill(0),
                };
                result.datasets.push(ds);
            }
        }
    }

    result.datasets.sort((a, b) => a.label < b.label ? 1 : -1);

    result.datasets.forEach((ds) => {
        const feedbackScore: number = +ds.label;
        ds.label = feedbackScore + ' - ' + getScoreTextById(feedbackScore);
    });

    return result;
}

export async function infermedicaTriageByComplaint(accountName: string, mode: Mode, fromTime: string, toTime: string, top: number) {
    let q = `customEvents | where customDimensions["tenantName"] == "${accountName}" and timestamp >= todatetime("${fromTime}") and timestamp < todatetime("${toTime}")`;
    q += ` and name in ("InfermedicaAssessmentStart") and isnotnull(customDimensions.initialSymptoms)
    | extend initialComplaintName = parsejson(tostring(customDimensions.['initialSymptoms']))
    | mvexpand initialComplaintName`;

    if (mode === Mode.HOURS) {
        q += ` | summarize count() by bin(timestamp, 1h), label=tostring(initialComplaintName)`;
        q += ` | make-series sum(count_) default=0 on timestamp in range(todatetime("${fromTime}"), todatetime("${toTime}"), 1h) by label`;
    }
    else if (mode === Mode.DAYS) {
        q += ` | summarize count() by bin(timestamp, 1d), label=tostring(initialComplaintName)`;
        q += ` | make-series sum(count_) default=0 on timestamp in range(todatetime("${fromTime}"), todatetime("${toTime}"), 1d) by label`;
    }
    else if (mode === Mode.MONTHS) {
        q += ` | summarize count() by month=startofmonth(timestamp), label=tostring(initialComplaintName)`;
    }
    const data = await executeQuery(q);
    return processReportByTime(data, mode, fromTime, toTime, top);
}

export async function capitaTriageByComplaint(accountName: string, mode: Mode, fromTime: string, toTime: string, top: number) {
    const q = generateTriageQuery(accountName, fromTime, toTime, "CapitaAssessmentStart", "conceptName", mode);
    const data = await executeQuery(q);
    return processReportByTime(data, mode, fromTime, toTime, top);
}

export async function infermedicaTriageByOutcome(accountName: string, mode: Mode, fromTime: string, toTime: string, top: number) {
    const q = generateTriageQuery(accountName, fromTime, toTime, "InfermedicaTriageOutcome", "triageOutcome", mode);
    const data = await executeQuery(q);
    return processReportByTime(data, mode, fromTime, toTime, top);
}

export async function capitaTriageByOutcome(accountName: string, mode: Mode, fromTime: string, toTime: string, top: number) {
    const q = generateTriageQuery(accountName, fromTime, toTime, "CapitaTriageOutcome", "triageOutcome", mode);
    const data = await executeQuery(q);
    return processReportByTime(data, mode, fromTime, toTime, top);
}

export async function unrecognizedUtterances(accountName: string, mode: Mode, fromTime: string, toTime: string, top: number) {
    let q = `customEvents | where customDimensions["tenantName"] == "${accountName}" and timestamp >= todatetime("${fromTime}") and timestamp < todatetime("${toTime}")`;
    q += ' and name in ("TopLevelUtterance", "UserComplaintMisunderstanding", "UtteranceMisunderstanding")';
    if (mode === Mode.HOURS) {
        q += ` | summarize count() by bin(timestamp, 1h), name`;
        q += ` | make-series sum(count_) default=0 on timestamp in range(todatetime("${fromTime}"), todatetime("${toTime}"), 1h) by name`;
    }
    else if (mode === Mode.DAYS) {
        q += ` | summarize count() by bin(timestamp, 1d), name`;
        q += ` | make-series sum(count_) default=0 on timestamp in range(todatetime("${fromTime}"), todatetime("${toTime}"), 1d) by name`;
    }
    else if (mode === Mode.MONTHS) {
        q += ` | summarize count() by month=startofmonth(timestamp), name`;
    }

    const data = await executeQuery(q);
    if (data.tables[0].rows.length === 0) {
        return {
            labels: [],
            datasets: []
        };
    }
    const result = processReportByTime(data, mode, fromTime, toTime, top);

    const rightAxisValue = {
        minValue: 0,
        maxValue: 100,
        valuePostfix: "%",
        label: "Percentage"
    };

    result['rightAxis'] = rightAxisValue;
    result['leftAxis'] = {label: "Total"};

    const topLevelUtteranceDS = result.datasets.filter((ds) => ds.label === "TopLevelUtterance")[0];
    const unrecognizedType1 = result.datasets.filter((ds) => ds.label === "UserComplaintMisunderstanding")[0];
    const unrecognizedType2 = result.datasets.filter((ds) => ds.label === "UtteranceMisunderstanding")[0];

    const ratioDS = {
        stack: "m",
        label: "Unrecognized utterances ratio",
        data: new Array(topLevelUtteranceDS.data.length).fill(0)
    };
    const unrecognizedDS = {
        stack: "m",
        label: "Unrecognized utterances count",
        data: new Array(topLevelUtteranceDS.data.length).fill(0)
    };

    topLevelUtteranceDS.data.forEach((utterancesCount, i) => {
        let unrecognizedCount = 0;
        if (unrecognizedType1) {
            unrecognizedCount += unrecognizedType1.data[i];
        }
        if (unrecognizedType2) {
            unrecognizedCount += unrecognizedType2.data[i];
        }
        unrecognizedDS.data[i] = unrecognizedCount;
        const ratio = utterancesCount === 0 ? 0 : Math.min(100, Math.floor(100 * (unrecognizedCount / utterancesCount)));
        ratioDS.data[i] = ratio;
    });

    result.datasets = [ ratioDS, unrecognizedDS ];
    return result;
}

function processReportByTime(data: any, mode: Mode, fromTime: string, toTime: string, top = -1) {
    const result = {
        labels: [],
        datasets: [],
        summary: null,
        rightTitleText1: null,
        rightTitleText2: null
    };
    if (data.tables[0].rows.length === 0) {
        return result;
    }

    let sortedTimestamps: string[];
    const valuesMap = {};

    if (mode === Mode.MONTHS) {
        sortedTimestamps = [
            moment(fromTime).format("YYYY-MM-01T00:00:00") + "Z",
            moment(fromTime).add(1, 'month').format("YYYY-MM-01T00:00:00") + "Z",
            moment(fromTime).add(2, 'month').format("YYYY-MM-01T00:00:00") + "Z"
        ];
        for (const row of data.tables[0].rows) {
            const timestamp = row[0];
            const label = row[1];
            const count = row[2];
            if (!valuesMap[label]) {
                valuesMap[label] = {};
            }
            valuesMap[label][timestamp] = count;
        }
        for (const label of Object.keys(valuesMap)) {
            for (const ts of sortedTimestamps) {
                if (!valuesMap[label][ts]) {
                    valuesMap[label][ts] = 0;
                }
            }
        }
    }
    else {
        for (const row of data.tables[0].rows) {
            const label = row[0];
            const counts = JSON.parse(row[1]);
            const timestamps = JSON.parse(row[2]);
            valuesMap[label] = {};
            for (let i = 0; i < timestamps.length; i++) {
                valuesMap[label][timestamps[i]] = counts[i];
            }
        }
        sortedTimestamps = JSON.parse(data.tables[0].rows[0][2]).sort();
        sortedTimestamps.pop();
    }
    result.labels = sortedTimestamps.map((ts) => (mode === Mode.HOURS) ? moment.utc(ts).format("YYYY-MM-DDTHH:00:00.000") : (mode === Mode.DAYS) ? moment(ts).format("DD MMM") : moment(ts).format("MMM YYYY"));
    result.datasets = [];
    for (const label of Object.keys(valuesMap)) {
        const ds = {
            stack: "m",
            label,
            data: sortedTimestamps.map((ts) => valuesMap[label][ts]),
            total: 0
        };
        ds.data.forEach((count) => ds.total += count);
        result.datasets.push(ds);
    }
    result.datasets.sort((a, b) => a.total < b.total ? 1 : -1);

    if (top > 0 && result.datasets.length > top) {
        const other = {
            stack: "m",
            label: "Other",
            data: new Array(sortedTimestamps.length).fill(0)
        };
        while (result.datasets.length > top - 1) {
            result.datasets.pop().data.forEach((count, i) => other.data[i] += count);
        }
        result.datasets.push(other);
    }
    result.datasets.forEach((ds) => delete ds.total);

    return result;
}

function generateTriageQuery(accountName: string, fromTime: string, toTime: string, eventName: string, customDimensions: string, mode: Mode) {
    let q = `customEvents | where customDimensions["tenantName"] == "${accountName}" and timestamp >= todatetime("${fromTime}") and timestamp < todatetime("${toTime}")`;
    q += ` and name in ("${eventName}")`;
    if (mode === Mode.HOURS) {
        q += ` | summarize count() by bin(timestamp, 1h), label=tostring(customDimensions["${customDimensions}"])`;
        q += ` | make-series sum(count_) default=0 on timestamp in range(todatetime("${fromTime}"), todatetime("${toTime}"), 1h) by label`;
    } else if (mode === Mode.DAYS) {
        q += ` | summarize count() by bin(timestamp, 1d), label=tostring(customDimensions["${customDimensions}"])`;
        q += ` | make-series sum(count_) default=0 on timestamp in range(todatetime("${fromTime}"), todatetime("${toTime}"), 1d) by label`;
    } else if (mode === Mode.MONTHS) {
        q += ` | summarize count() by month=startofmonth(timestamp), label=tostring(customDimensions["${customDimensions}"])`;
    }
    return q;
}

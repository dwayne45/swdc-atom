'use babel';

import $ from 'jquery';
import fs from 'fs';
import path from 'path';
import KpmItem from '../model/KpmItem';
import SessionSummary from '../model/SessionSummary';

const offlineMgr = require('../OfflineManager');

const utilMgr = require('../UtilManager');
const gitUtil = require('../git/GitUtil');
const numeral = require('numeral');
const moment = require('moment-timezone');

export default class CodeTimeProvider {
    constructor() {
        this.currentKeystrokeStats = new SessionSummary();
        const htmlString = fs.readFileSync(
            path.join(__dirname, '../..', 'templates', 'structure-view.html'),
            {
                encoding: 'utf-8',
            }
        );
        this.element = $(htmlString).get(0);
        this.viewType = 'codetimeProvider';
    }
    showLoader() {
        $('#tree-content').hide();
        $('#loader').show();
    }

    hideLoader() {
        $('#tree-content').show();
        $('#loader').hide();
    }

    initialize() {
        this.showLoader();
        this.renderTree();
    }

    toggleDeviceStatus(isHide) {
        if (isHide) {
            $('#spotify-player-device').hide();
        } else {
            $('#spotify-player-device').show();
        }
    }

    toggleRefreshTreeview(isHide) {
        if (isHide) {
            $('#refresh-treeview').hide();
        } else {
            $('#refresh-treeview').show();
        }
    }

    renderTree() {
        let html = this.treeGenerator();
        $('div.structure-view>div>ol').html(html);
        this.hideLoader();
    }

    clearTree() {
        $('div.structure-view>div>ol').html('');
    }

    treeGenerator() {
        // const self = this;

        if (utilMgr.showingStatusBarText()) {
            $('#toggle-status-metrics').html('Hide status bar metrics');
        } else {
            $('#toggle-status-metrics').html('Show status bar metrics');
        }

        const sessionSummaryData = offlineMgr.getSessionSummaryData();
        const metricNodesHtml = this.buildMetricsNodes(sessionSummaryData);

        const projectMetricNodesHtml = this.buildCommitTreeNodes();

        // console.log('nodes html: ', metricNodesHtml);
        $('#code-time-metrics').html(metricNodesHtml);
        $('#code-project-metrics').html(projectMetricNodesHtml);
    }

    setCurrentKeystrokeStats(keystrokeStats) {
        if (!keystrokeStats) {
            this.currentKeystrokeStats = new SessionSummary();
        } else {
            // update the current stats
            Object.keys(keystrokeStats.source).forEach(key => {
                const fileInfo: FileChangeInfo = keystrokeStats.source[key];
                this.currentKeystrokeStats.currentDayKeystrokes =
                    fileInfo.keystrokes;
                this.currentKeystrokeStats.currentDayLinesAdded =
                    fileInfo.linesAdded;
                this.currentKeystrokeStats.currentDayLinesRemoved =
                    fileInfo.linesRemoved;
            });
        }
    }

    buildProjectMetricNodes(data) {
        return '';
    }

    buildMetricsNodes(data) {
        const liItems = [];

        // EDITOR-TIME metric
        const editorMinutes = '0 min';
        liItems.push(
            this.buildCodeTimeMetricsLiItem(
                'editor-time',
                'Editor time',
                editorMinutes
            )
        );

        // CODE-TIME node
        const codeTimeMinutes = utilMgr.humanizeMinutes(data.currentDayMinutes);
        const avgDailyMinutes = utilMgr.humanizeMinutes(
            data.averageDailyMinutes
        );
        const globalAvgMinutes = utilMgr.humanizeMinutes(
            data.globalAverageSeconds / 60
        );
        liItems.push(
            this.buildCodeTimeMetricsLiItem(
                'code-time',
                'Code time',
                codeTimeMinutes,
                avgDailyMinutes,
                globalAvgMinutes
            )
        );

        const currLinesAdded =
            this.currentKeystrokeStats.currentDayLinesAdded +
            data.currentDayLinesAdded;
        const linesAdded = numeral(currLinesAdded).format('0 a');
        const avgLinesAdded = numeral(data.averageLinesAdded).format('0 a');
        const globalLinesAdded = numeral(data.globalAverageLinesAdded).format(
            '0 a'
        );
        liItems.push(
            this.buildCodeTimeMetricsLiItem(
                'lines-added',
                'Lines added',
                linesAdded,
                avgLinesAdded,
                globalLinesAdded
            )
        );

        const currLinesRemoved =
            this.currentKeystrokeStats.currentDayLinesRemoved +
            data.currentDayLinesRemoved;
        const linesRemoved = numeral(currLinesRemoved).format('0 a');
        const avgLinesRemoved = numeral(data.averageLinesRemoved).format('0 a');
        const globalLinesRemoved = numeral(
            data.globalAverageLinesRemoved
        ).format('0 a');
        liItems.push(
            this.buildCodeTimeMetricsLiItem(
                'lines-removed',
                'Lines removed',
                linesRemoved,
                avgLinesRemoved,
                globalLinesRemoved
            )
        );

        const currKeystrokes =
            this.currentKeystrokeStats.currentDayKeystrokes +
            data.currentDayKeystrokes;
        const keystrokes = numeral(currKeystrokes).format('0 a');
        const avgKeystrokes = numeral(data.averageDailyKeystrokes).format(
            '0 a'
        );
        const globalKeystrokes = numeral(
            data.globalAverageDailyKeystrokes
        ).format('0 a');
        liItems.push(
            this.buildCodeTimeMetricsLiItem(
                'keystrokes',
                'Keystrokes',
                keystrokes,
                avgKeystrokes,
                globalKeystrokes
            )
        );

        // build the editor time li
        return `<ul>${liItems.join('\n')}</ul>`;
    }

    async buildCommitTreeNodes() {
        const liItems = [];

        const folders = utilMgr.getOpenProjects();
        if (folders && folders.length > 0) {
            for (let i = 0; i < folders.length; i++) {
                const dir = folders[i];
                const currentChagesSummary = await gitUtil.getUncommitedChanges(
                    projectDir
                );
                const basename = path.basename(dir);
                const openChangeItem = this.buildOpenChangesLiItem(
                    `dir-${i}`,
                    '',
                    currentChagesSummary.insertions,
                    currentChagesSummary.deletions
                );
            }
        }

        // build the editor time li
        return `<ul>${liItems.join('\n')}</ul>`;
    }

    buildCodeTimeMetricsLiItem(
        id,
        label,
        todayValue,
        avgValue = null,
        globalAvgValue = null
    ) {
        if (avgValue && globalAvgValue) {
            return `
                <li>
                    <input type="checkbox" id="${id}" />
                    <label for="${id}">${label}</label>
                    <ul>
                        <li><a href="#" id="${id}-today">Today: ${todayValue}</a></li>
                        <li>
                            <a href="#" id="${id}-avg">Your average: ${avgValue}</a>
                        </li>
                        <li>
                            <a href="#" id="${id}-global">Global average: ${globalAvgValue}</a>
                        </li>
                    </ul>
                </li>`;
        }

        return `
            <li>
                <input type="checkbox" id="${id}" />
                <label for="${id}">${label}</label>
                <ul>
                    <li><a href="#" id="${id}-today">Today: ${todayValue}</a></li>
                </ul>
            </li>`;
    }

    buildOpenChangesLiItem(id, label, insertions, deletions) {
        return `
            <li>
                <input type="checkbox" id="${id}" />
                <label for="${id}">${label}</label>
                <ul>
                    <li><a href="#" id="${id}-insertions">Insertion(s): ${insertions}</a></li>
                    <li>
                        <a href="#" id="${id}-deletions">Deletion(s): ${deletions}</a>
                    </li>
                </ul>
            </li>`;
    }

    serialize() {}

    destroy() {
        this.element.remove();
    }

    getElement() {
        return this.element;
    }

    getTitle() {
        return 'Code Time';
    }
}

$(document).on('click', '#advanced-metrics', async function() {
    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Code-Time:web-dashboard'
    );
});

$(document).on('click', '#generate-dashboard', async function() {
    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Code-Time:dashboard'
    );
});

$(document).on('click', '#toggle-status-metrics', async function() {
    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Code-Time:toggle-status-bar-metrics'
    );
});
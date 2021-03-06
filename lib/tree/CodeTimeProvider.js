'use babel';

import $ from 'jquery';
import path from 'path';
import SessionSummary from '../model/SessionSummary';
import { getCodeTimeSummary } from '../managers/TimeDataManager';
import fileIt from 'file-it';
const fileChangeInfoSummaryDataMgr = require('../storage/FileChangeInfoSummaryDataManager');
const projectMgr = require("../managers/ProjectManager");
const statusMgr = require('../managers/StatusManager');
const utilMgr = require('../UtilManager');
const fileDataMgr = require('../storage/FileDataManager');
const eventMgr = require('../managers/EventManager');
const gitUtil = require('../repo/GitUtil');
const numeral = require('numeral');
const moment = require('moment-timezone');
const tracker = require("../managers/TrackerManager");

let checkedMap = {
    'editor-time': true,
    'code-time': true,
};

export default class CodeTimeProvider {
    constructor() {
        this.currentKeystrokeStats = new SessionSummary();
        const filename = path.join(__dirname, '../..', 'templates', 'structure-view.html');
        const htmlString = fileIt.readContentFileSync(filename);
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

    getAuthTypeLabelAndClass() {
        const authType = utilMgr.getItem('authType');
        const name = utilMgr.getItem("name");
        const label = `${name}`;
        if (authType === 'google') {
            return { label, class: 'google-icon' };
        } else if (authType === 'github') {
            return { label, class: 'github-icon' };
        } else if (authType === 'software') {
            return { label, class: 'envelope-icon' };
        }
        return { label, class: 'envelope-icon' };
    }

    async treeGenerator() {
        if (statusMgr.showingStatusBarText()) {
            $('#toggle-status-metrics').html('Hide status bar metrics');
        } else {
            $('#toggle-status-metrics').html('Show status bar metrics');
        }

        const name = utilMgr.getItem('name');
        if (name) {
            $('#google-signup').hide();
            $('#github-signup').hide();
            $('#email-signup').hide();
            $('#signup-divider').hide();

            const labelIconData = this.getAuthTypeLabelAndClass();
            $('#connected-type-button').html(labelIconData.label);
            $('#connected-type-button').addClass(labelIconData.class);

            $('#connected-type-button').show();
        } else {
            $('#google-signup').show();
            $('#github-signup').show();
            $('#email-signup').show();
            $('#signup-divider').show();
            $('#connected-type-button').hide();
        }

        const data = fileDataMgr.getSessionSummaryData();

        const metricNodesHtml = await this.buildMetricsNodes(data);

        $('#code-time-metrics').html(metricNodesHtml);

        const contributorNodesHtml = await this.buildContributorNodes();
        $('#code-contributors-metrics').html(contributorNodesHtml);
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

    async buildMetricsNodes(data) {
        const liItems = [];

        const fileChangeInfoMap = fileChangeInfoSummaryDataMgr.getFileChangeSummaryAsJson();
        const codeTimeSummary = getCodeTimeSummary();

        // EDITOR-TIME metric
        const editorMinutes = utilMgr.humanizeMinutes(
            codeTimeSummary.codeTimeMinutes
        );
        liItems.push(
            this.buildCodeTimeMetricsLiItem(
                'editor-time',
                'Code time',
                editorMinutes
            )
        );

        // CODE-TIME node
        const codeTimeMinutes = utilMgr.humanizeMinutes(
            codeTimeSummary.activeCodeTimeMinutes
        );
        const avgDailyMinutes = utilMgr.humanizeMinutes(
            data.averageDailyMinutes
        );
        const globalAvgMinutes = utilMgr.humanizeMinutes(
            data.globalAverageSeconds / 60
        );
        let boltIcon =
            data.currentDayMinutes > data.averageDailyMinutes
                ? 'bolt-icon'
                : 'bolt-grey-icon';
        liItems.push(
            this.buildCodeTimeMetricsLiItem(
                'code-time',
                'Active code time',
                codeTimeMinutes,
                avgDailyMinutes,
                globalAvgMinutes,
                boltIcon
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
        boltIcon =
            data.currentDayLinesAdded > data.averageLinesAdded
                ? 'bolt-icon'
                : 'bolt-grey-icon';
        liItems.push(
            this.buildCodeTimeMetricsLiItem(
                'lines-added',
                'Lines added',
                linesAdded,
                avgLinesAdded,
                globalLinesAdded,
                boltIcon
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
        boltIcon =
            data.currentDayLinesRemoved > data.averageLinesRemoved
                ? 'bolt-icon'
                : 'bolt-grey-icon';
        liItems.push(
            this.buildCodeTimeMetricsLiItem(
                'lines-removed',
                'Lines removed',
                linesRemoved,
                avgLinesRemoved,
                globalLinesRemoved,
                boltIcon
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
        boltIcon =
            data.currentDayKeystrokes > data.averageDailyKeystrokes
                ? 'bolt-icon'
                : 'bolt-grey-icon';
        liItems.push(
            this.buildCodeTimeMetricsLiItem(
                'keystrokes',
                'Keystrokes',
                keystrokes,
                avgKeystrokes,
                globalKeystrokes,
                boltIcon
            )
        );

        // get the top file nodes and add it to the liItems
        const topFileNodes = this.buildTopFileNodes(fileChangeInfoMap);
        liItems.push(...topFileNodes);

        const fileChangeInfos = Object.keys(fileChangeInfoMap).map(key => {
            return fileChangeInfoMap[key];
        });
        const topKpmFileNodes = this.topFilesMetricNode(
            fileChangeInfos,
            'Top files by KPM',
            'kpm',
            'top-kpm-files'
        );
        liItems.push(topKpmFileNodes);

        const topKeystrokeFileNodes = this.topFilesMetricNode(
            fileChangeInfos,
            'Top files by keystrokes',
            'keystrokes',
            'top-keystrokes-files'
        );
        liItems.push(topKeystrokeFileNodes);

        const topCodetimeFileNodes = this.topFilesMetricNode(
            fileChangeInfos,
            'Top files by code time',
            'codetime',
            'top-codetime-files'
        );
        liItems.push(topCodetimeFileNodes);

        const commitTreeNodes = await this.buildCommitTreeNodes();
        liItems.push(...commitTreeNodes);

        // build the editor time li
        return `<ul>${liItems.join('\n')}</ul>`;
    }

    async buildCommitTreeNodes() {
        const commitTreeNodes = [];

        const folders = utilMgr.getOpenProjects();
        if (folders && folders.length > 0) {
            const openChangesDirNodes = [];
            const committedChangesDirNodes = [];
            for (let i = 0; i < folders.length; i++) {
                const dir = folders[i];
                // get uncommitted change info
                const currentChangesummary = await gitUtil.getUncommitedChanges(
                    dir
                );

                const basename = path.basename(dir);
                const openChangesNodeHtml = this.buildOpenChangesDirNodeItem(
                    `uncommitted-${i}`,
                    basename,
                    currentChangesummary.insertions,
                    currentChangesummary.deletions
                );
                openChangesDirNodes.push(openChangesNodeHtml);

                // get the completed commits of today
                const todaysChangeSummary = await gitUtil.getTodaysCommits(dir);

                const committedChangesNodeHtml = this.buildOpenChangesDirNodeItem(
                    `commited-${i}`,
                    basename,
                    todaysChangeSummary.insertions,
                    todaysChangeSummary.deletions,
                    todaysChangeSummary.commitCount,
                    todaysChangeSummary.fileCount
                );
                committedChangesDirNodes.push(committedChangesNodeHtml);
            }
            const openChangesNodeHtml = this.buildMetricNodeItem(
                'open-changes',
                'Open changes',
                openChangesDirNodes
            );
            const committedChangesNodeHtml = this.buildMetricNodeItem(
                'commited-changes',
                'Committed today',
                committedChangesDirNodes
            );
            commitTreeNodes.push(openChangesNodeHtml);
            commitTreeNodes.push(committedChangesNodeHtml);
        }

        return commitTreeNodes;
    }

    async buildContributorNodes() {
        const liItems = [];

        const projectDir = projectMgr.getFirstProjectDirectory();

        if (projectDir) {
            // get ContributorMember[]
            const contributorMembers = await gitUtil.getRepoContributors(
                projectDir
            );

            const remoteUrl = await gitUtil.getRepoUrlLink(projectDir);

            if (contributorMembers && contributorMembers.length) {
                const title = this.buildContributorRepoGenerateLiItem(
                    contributorMembers[0].identifier
                );
                liItems.push(title);

                for (let i = 0; i < contributorMembers.length; i++) {
                    const contributor = contributorMembers[i];
                    const lastCommitInfo = await gitUtil.getLastCommitId(
                        projectDir,
                        contributor.email
                    );

                    const contributorNode = this.buildContributorLiItem(
                        `member-${contributor.email}`,
                        contributor.email,
                        lastCommitInfo,
                        remoteUrl
                    );

                    liItems.push(contributorNode);
                }
            }
        }

        return `<ul>${liItems.join('\n')}</ul>`;
    }

    buildTopFileNodes(fileChangeInfoMap) {
        const topFileTreeNodes = [];

        const filesChanged = fileChangeInfoMap
            ? Object.keys(fileChangeInfoMap).length
            : 0;

        if (filesChanged > 0) {
            topFileTreeNodes.push(
                this.buildSingleNodeLiItem(
                    'files-changed',
                    'Files changed today',
                    `Today: ${filesChanged}`
                )
            );
        }

        return topFileTreeNodes;
    }

    buildSingleNodeLiItem(id, label, value) {
        const checkedProp = this.getCheckedPropertyForId(id);
        return `
            <li>
                <input type="checkbox" id="${id}" value="${label}"${checkedProp}/>
                <label for="${id}">${label}</label>
                <ul>
                    <li><a href="#" id="${id}-today">${value}</a></li>
                </ul>
            </li>`;
    }

    buildContributorRepoGenerateLiItem(value) {
        return `<li><a href="#" id="generate-contributor-summary">${value}</a></li>`;
    }

    buildSingleValueLiItem(id, value, fileName) {
        return `<li><a href="#" id="${id}-view-file" class="view-file" data-file="${fileName}">${value}</a></li>`;
    }

    buildContributorLiItem(id, label, lastCommitInfo, remoteUrl) {
        const link = lastCommitInfo
            ? `${remoteUrl}/commit/${lastCommitInfo.commitId}`
            : '';

        const checkedProp = this.getCheckedPropertyForId(id);
        if (lastCommitInfo) {
            return `
                <li>
                    <input type="checkbox" id="${id}" value="${label}"${checkedProp}/>
                    <label for="${id}">${label}</label>
                    <ul>
                        <li><a href=${link} id="${id}-commitId">${
                lastCommitInfo.comment
            }</a></li>
                    </ul>
                </li>`;
        } else {
            return `<li><a href="#" id="${id}">${value}</a></li>`;
        }
    }

    buildCodeTimeMetricsLiItem(
        id,
        label,
        todayValue,
        avgValue = null,
        globalAvgValue = null,
        boltIcon = null
    ) {
        const checkedProp = this.getCheckedPropertyForId(id);
        const dayStr = moment().format('ddd');
        if (avgValue && globalAvgValue) {
            boltIcon = boltIcon ? boltIcon : 'bolt-grey';
            return `
                <li>
                    <input type="checkbox" id="${id}" value="${label}"${checkedProp}/>
                    <label for="${id}">${label}</label>
                    <ul>
                        <li><a href="#" id="${id}-today" class="rocket-icon">Today: ${todayValue}</a></li>
                        <li>
                            <a href="#" id="${id}-avg" class="${boltIcon}">Your average (${dayStr}): ${avgValue}</a>
                        </li>
                        <li>
                            <a href="#" id="${id}-global" class="global-grey-icon">Global average (${dayStr}): ${globalAvgValue}</a>
                        </li>
                    </ul>
                </li>`;
        }

        return `
            <li>
                <input type="checkbox" id="${id}" value="${label}"${checkedProp}/>
                <label for="${id}">${label}</label>
                <ul>
                    <li><a href="#" id="${id}-today" class="rocket-icon">Today: ${todayValue}</a></li>
                </ul>
            </li>`;
    }

    buildOpenChangesDirNodeItem(
        id,
        label,
        insertions,
        deletions,
        commitCount = null,
        fileCount = null
    ) {
        const checkedProp = this.getCheckedPropertyForId(id);
        if (commitCount === null) {
            return `
                <li>
                    <input type="checkbox" id="${id}" value="${label}"${checkedProp}/>
                    <label for="${id}">${label}</label>
                    <ul>
                        <li><a href="#" id="${id}-insertions" class="insertion-icon">Insertion(s): ${insertions}</a></li>
                        <li>
                            <a href="#" id="${id}-deletions" class="deletion-icon">Deletion(s): ${deletions}</a>
                        </li>
                    </ul>
                </li>`;
        } else {
            return `
                    <li>
                        <input type="checkbox" id="${id}" value="${label}"${checkedProp}/>
                        <label for="${id}">${label}</label>
                        <ul>
                            <li><a href="#" id="${id}-insertions" class="insertion-icon">Insertion(s): ${insertions}</a></li>
                            <li>
                                <a href="#" id="${id}-deletions" class="deletion-icon">Deletion(s): ${deletions}</a>
                            </li>
                            <li><a href="#" id="${id}-commit-count" class="commit-icon">Commit(s): ${commitCount}</a></li>
                            <li>
                                <a href="#" id="${id}-file-count" class="files-icon">Files changed: ${fileCount}</a>
                            </li>
                        </ul>
                    </li>`;
        }
    }

    buildMetricNodeItem(id, label, nodes) {
        const checkedProp = this.getCheckedPropertyForId(id);
        return `
        <ul>
            <li>
                <input type="checkbox" id="${id}" value="${label}"${checkedProp}/>
                <label for="${id}">${label}</label>
                <ul>
                    ${nodes.join('\n')}
                </ul>
            </li>
        </ul>`;
    }

    getCheckedPropertyForId(id) {
        if (checkedMap[id]) {
            return checkedMap[id] === true ? ' checked' : '';
        }
        return '';
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

    topFilesMetricNode(fileChangeInfos, name, sortBy, id) {
        if (!fileChangeInfos || fileChangeInfos.length === 0) {
            return null;
        }
        // Highest KPM
        let sortedArray = [];
        if (sortBy === 'kpm') {
            sortedArray = fileChangeInfos.sort(
                (a, b) => b.kpm - a.kpm
            );
        } else if (sortBy === 'keystrokes') {
            sortedArray = fileChangeInfos.sort(
                (a, b) => b.keystrokes - a.keystrokes
            );
        } else if (sortBy === 'codetime') {
            // duration_seconds
            sortedArray = fileChangeInfos.sort(
                (a, b) => b.duration_seconds - a.duration_seconds
            );
        }
        const childrenNodes = [];
        const len = Math.min(3, sortedArray.length);
        for (let i = 0; i < len; i++) {
            const sortedObj = sortedArray[i];
            const fileName = sortedObj.name;
            let val = 0;
            if (sortBy === 'kpm') {
                const kpmVal = sortedObj.kpm || 0;
                val = numeral(kpmVal).format('0 a');
            } else if (sortBy === 'keystrokes') {
                const keystrokesVal = sortedObj.keystrokes || 0;
                val = numeral(keystrokesVal).format('0 a');
            } else if (sortBy === 'codetime') {
                const durSecondsVal = sortedObj.duration_seconds || 0;
                val = utilMgr.humanizeMinutes(durSecondsVal);
            }
            const fsPath = sortedObj.fsPath;
            const label = `${fileName} | ${val}`;

            const valueItem = this.buildSingleValueLiItem(
                sortBy,
                label,
                fsPath
            );
            childrenNodes.push(valueItem);
        }
        const parentMetricsNode = this.buildMetricNodeItem(
            id,
            name,
            childrenNodes
        );

        return parentMetricsNode;
    }
}

$(document).on('click', '#generate-contributor-summary', async () => {
    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Code-Time:generate-contributor-summary',
        "click"
    );
});

$(document).on('click', '#google-signup', async () => {
    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Code-Time:google-signup',
        "click"
    );
});

$(document).on('click', '#github-signup', async () => {
    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Code-Time:github-signup',
        "click"
    );
});

$(document).on('click', '#email-signup', async () => {
    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Code-Time:email-signup',
        "click"
    );
});

$(document).on('click', '#advanced-metrics', async () => {
    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Code-Time:see-advanced-metrics',
        "click"
    );
});

$(document).on('click', '#generate-dashboard', async () => {
    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Code-Time:view-summary',
        "click"
    );
});

$(document).on('click', '#toggle-status-metrics', async () => {
    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Code-Time:toggle-status-bar-metrics',
        "click"
    );
});

$(document).on('click', '#submit-feedback', async () => {
    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Code-Time:submit-feedback',
        "click"
    );
});

$(document).on('click', '#learn-more', async () => {
    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Code-Time:learn-more',
        "click"
    );
});

$(document).on('click', '.view-file', async el => {
  try {
    const val = $(el.currentTarget).attr('data-file');
    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Code-Time:open-file',
        val
    );
  } catch (e) {
    //
  }
});

const toggleItems = ["ct_codetime_toggle_node",
  "ct_active_codetime_toggle_node",
  "ct_lines_added_toggle_node",
  "ct_lines_removed_toggle_node",
  "ct_keystrokes_toggle_node",
  "ct_files_changed_toggle_node",
  "ct_top_files_by_kpm_toggle_node",
  "ct_top_files_by_keystrokes_toggle_node",
  "ct_top_files_by_codetime_toggle_node",
  "ct_open_changes_toggle_node",
  "ct_committed_today_toggle_node"];

function getToggleItem(normalizedLabel) {
  for (let i = 0; i < toggleItems.length; i++) {
    const toggleItem = toggleItems[i];
    // strip off "ct_" and "_toggle_node" and replace the "_" with ""
    const normalizedToggleItem = toggleItem.replace("ct_", "").replace("_toggle_node", "").replace(/_/g, "");
    if (normalizedLabel.toLowerCase().indexOf(normalizedToggleItem) !== -1) {
      return toggleItem;
    }
  }
  return null;
}

$(document).on('click', 'input[type=checkbox]', async el => {
    if (!el.currentTarget) {
        return;
    }

    const checked =
        el.currentTarget.checked !== null &&
        el.currentTarget.checked !== undefined
            ? el.currentTarget.checked
            : false;
    // create the code time event
    const origLabel = el.currentTarget.value;
    const label = origLabel ? origLabel.replace(/\s/g, '') : origLabel;

    // label will look like "Linesadded" or ct_lines_added_toggle_node
    const toggleItemName = getToggleItem(label);
    if (toggleItemName) {
      const uiElement = {
        element_name: toggleItemName,
        element_location: "ct_metrics_tree",
        cta_text: origLabel,
        color: null,
        icon_name: null
      };
      tracker.trackUIInteraction("click", uiElement);
    }

    checkedMap[el.currentTarget.id] = checked;
});

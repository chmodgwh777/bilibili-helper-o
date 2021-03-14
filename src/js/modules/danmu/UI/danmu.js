/**
 * Author: DrowsyFlesh
 * Create: 2018/10/22
 * Description:
 */
import _ from 'lodash';
import $ from 'jquery';
import PropTypes from 'prop-types';
import React from 'react';
import apis from '../apis.js';
import Url from 'url-parse';
import styled from 'styled-components';
import {Button} from 'Components/common/Button';
import {Crc32Engine} from 'Libs/crc32';
import {List} from 'react-virtualized';
import {getFilename, parseTime, encodeHTMLEntries} from 'Utils';
import {theme} from 'Styles';
import './styles.scss';
import 'react-virtualized/styles.css';

export default () => {
    const {color} = theme;
    const crcEngine = new Crc32Engine();

    const Title = styled.div.attrs({className: 'bilibili-helper-danmu-title'})`
      margin-bottom: 6px;
      font-size: 12px;
      font-weight: bold;
      text-align: left;
      .count {
        margin-left: 10px;
        color: ${color('google-grey-500')};
      }
    `;

    const DanmuList = styled(List).attrs({className: 'bilibili-helper-danmu-list'})`
      position: relative;
      height: 200px;
      margin-left: 4px;
      padding: 1px;
      border: 1px solid #eee;
      border-radius: 4px 4px 0 0;
      font-size: 12px;
      overflow: hidden;
      outline: none;
      & .no-data {}
    `;
    const UnloadList = styled.div.attrs({className: 'bilibili-helper-danmu-list'})`
      position: relative;
      height: 200px;
      margin-left: 4px;
      padding: 1px;
      border: 1px solid #eee;
      border-radius: 4px 4px 0 0;
      font-size: 12px;
      overflow: hidden;
      outline: none;
      
      button {
        display: block;
        position: relative;
        margin: 4px;
        padding: 3px 12px;
        border: none;        
        border-radius: 3px;
        font-size: 12px;
        letter-spacing: 0.3px;
        word-break: break-all;
        background-color: rgb(234, 244, 255);
        color: rgb(0, 161, 214);
        transition: all 0.3s ease 0s, visibility 0s ease 0s;
        cursor: pointer;
        overflow: hidden;
        &:hover {
          color: #004c65;
          background-color: #d4eaff;
        }
      }
    `;

    const DanmuSearchInput = styled.input.attrs({className: 'bilibili-helper-danmu-input'})`
      display: block;
      width: 418px;
      margin-left: 4px;
      padding: 4px 6px;
      box-sizing: border-box;
      border: 1px solid #eee;
      border-top: none;
      border-radius: 0 0 4px 4px;
      font-size: 12px;
    `;

    const DanmuListLine = styled.div`
      display: flex;
      margin-bottom: 1px;
      padding: 0 8px 1px;
      line-height: 20px;
      border-radius: 2px;
      background-color: ${({hasQueried}) => hasQueried ? '#d6e8f5' : 'white'};
      cursor: pointer;
      &:hover {
        color: #fff;
        background-color: #00a1d6;
        .target-words {
          color: #fff;
        }
      }
      & .time {
        flex-grow: 0;
        flex-shrink: 0;
        width: 30px;
        padding-right: 7px;
      }
      & .danmu {
        flex-grow: 1;
        margin: 0 7px 0 3px;
        padding: 0 7px;
        border-left: 1px solid #fff;
        border-right: 1px solid #fff;
        text-overflow: ellipsis;
        white-space: nowrap;
        overflow: hidden;
      }
      & .author {
        flex-shrink: 0;
        width: 100px;
        text-overflow: ellipsis;
        white-space: nowrap;
        overflow: hidden;
      }
      & .target-words {
        font-weight: bold;
        color: #00a1d6;
      }
    `;

    const LoadingMask = styled.div`
      display: flex;
      justify-content: center;
      align-items: center;
      position: absolute;
      top: 23px;
      right: 1px;
      bottom: 1px;
      left: 1px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: bold;
      letter-spacing: 1px;
      background-color: rgba(255, 255, 255, 0.8);
      cursor: no-drop;
      user-select: none;
    `;

    const DownloadBtn = styled(Button)`
      float: right;
      border-radius: 4px;
      margin-left: 10px;
      button {
        padding: 0;
        min-width: 35px;
        font-size: 12px;
        border: 1px solid ${color('bilibili-pink')};
        border-radius: 4px;
        color: ${({on}) => on ? '#fff' : color('bilibili-pink')};
        background-color: ${({on}) => on ? color('bilibili-pink') : '#fff'};
      }
    `;

    return class Danmu extends React.Component {
        propTypes = {
            settings: PropTypes.object,
        };

        constructor(props) {
            super(props);

            this.orderedJSON = {}; // 经过弹幕发送时间排序的数据
            this.userMap = {}; // uid -> data
            this.userCardMap = {}; // uid -> cardData
            this.queryUserModeTemplateMap = {}; // 切换到用户UID查询模式前，将之前的查询结果被分到该map中
            this.danmuDocumentStr = null;
            const today = new Date();
            this.danmuDate = `${today.getMonth() + 1}-${today.getDate()}`; // 当前弹幕日期
            this.addListener();

            this.danmuListRef = null;

            this.currentRowIndex = 0;

            this.authorHashMap = {}; // authorHash -> uid
            this.segmentDanmuList = [];
            this.segmentDanmuOid = null;
            this.segmentSize = 1;
            // 分页大小÷1000
            this.segmentDanmuPageSize = 360000;

            this.removeCardSign = null;
            this.lasetHeight = null;

            this.currentOid = null;
            this.currentPid = null;

            this.state = {
                loaded: false,
                loading: false,
                loadingText: null,
                danmuJSON: {list: []},
                filterText: '',
                /**
                 * 需要一个字段用于通知react重新渲染组件
                 * 这里选择使用较为简单的authorHashMap
                 */
                queryUserMode: null, // 用户UID查询模式

                currentCid: NaN,
                segmentDanmu: [], // 分段式弹幕加载
                needLoadByHandle: true,
            };
        }

        componentDidMount() {
            chrome.runtime.sendMessage({command: 'danmuDOMInitialized'});
            $('.player-sidebar-list-item-inner, .bnj-player-single-item-mask').click(() => {
                setTimeout(() => {
                    chrome.runtime.sendMessage({command: 'danmuDOMInitialized'});
                }, 500);
            });
        }

        addListener = () => {
            const that = this;
            chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
                if (message.command === 'loadNewTypeDanmu') { // 被通知加载新类型的弹幕
                    this.getNewDANMUList(message.oid, message.pid, message.segmentIndex);
                    sendResponse(true);
                } else if (message.command === 'loadHistoryDanmu') { // 被通知载入历史弹幕
                    if (message.date) {
                        this.getDANMUList(message.cid, message.date);
                        sendResponse(true);
                    } else {
                        console.error(`Error history danmu date: ${message.date}`);
                    }
                } else if (message.command === 'loadCurrentDanmu') { // 被通知载入当日弹幕
                    this.getDANMUList(message.cid);
                    sendResponse(true);
                }
                return true;
            });
            // 对pakku的hack，仅发送历史弹幕的请求
            window.addEventListener('message', function(e) {
                if (e.data.type === 'pakku_ajax_request' && /x\/v2\/dm\/history/.test(e.data.arg)) {
                    chrome.runtime.sendMessage({command: 'pakkuGetHistoryDanmu', url: e.data.arg});
                }
            });
            let n, m;
            $(document).on('mouseenter', '[helper-data-usercard-mid]', function() {
                that.createCard(this, $(this).attr('helper-data-usercard-mid'));
            });
            $(document).on('mouseenter', '[helper-data-usercard-mid], #helper-card', function() {
                that.removeCardSign = false;
                if (m) {
                    clearTimeout(m);
                    m = null;
                }
                m = setTimeout(() => {
                    if (document.querySelector('#helper-card')) {
                        document.querySelector('#helper-card').style.display = 'block';
                    }
                }, 300);
                if (n) {
                    clearTimeout(n);
                    n = null;
                }
                n = setTimeout(() => {
                    that.removeCardSign = true;
                }, 300);
            });
            $(document).on('mouseleave', '[helper-data-usercard-mid], #helper-card, .bilibili-helper-danmu-wrapper', function() {
                setTimeout(() => {
                    const dom = document.querySelector('#helper-card');
                    if (that.removeCardSign && dom) {
                        dom.style.display = 'none';
                    }
                }, 200);
            });
        };

        getNewDanmuOption = (oid, pid, type) => {
            return new Promise(resolve => {
                const url = new Url(apis.view);
                url.set('query', {type, oid, pid});
                chrome.runtime.sendMessage({command: 'fetchNewTypeDanmuOption', url: url.toString()}, (danmuOption) => {
                    resolve(danmuOption);
                });
            });

        };

        getNewDANMUList = (oid, pid, segmentIndex = 1) => {
            return new Promise((resolve, reject) => {
                if (oid) {
                    // 检测到新的分段弹幕需要加载
                    if (segmentIndex === 1 && this.segmentDanmuOid !== oid) {
                        this.segmentDanmuOid = oid;
                        this.segmentDanmuList = [];
                        this.getNewDanmuOption(oid, pid, 1)
                            .then(({pageSize, total}) => {
                                this.segmentDanmuPageSize = pageSize;
                                this.segmentSize = total;
                                this.currentOid = oid;
                                this.currentPid = pid;
                                this.setState({
                                    needLoadByHandle: true,
                                    loading: false,
                                    loadingText: '',
                                }, () => resolve());
                            });
                    } else {
                        resolve();
                    }
                } else {
                    this.setState({
                        needLoadByHandle: true,
                        loading: false,
                        loadingText: '',
                    });
                    reject();
                }
            });
        };

        getDanmuData = async (oid, pid, segmentIndex) => {
            const url = new Url(apis.seg);
            url.set('query', {
                type: 1,
                oid,
                pid,
                segment_index: segmentIndex,
            });
            return new Promise(resolve => {
                chrome.runtime.sendMessage({command: 'fetchNewTypeDanmu', url: url.toString()}, (danmuArray) => {
                    if (!danmuArray || danmuArray.length === 0) {
                        return resolve(false);
                    }
                    const targetData = danmuArray.map(({id: rowId, content: danmu, midHash: authorHash, mode, progress, fontsize, color, ctime, idStr, weight}) => {
                        if (mode === 7) {
                            try {
                                danmu = danmu.replace(/[\n\r]/g, '');
                                danmu = JSON.parse(danmu)[4];
                            } catch (e) {
                                console.error(danmu);
                            }
                        }
                        return {
                            rowId, content: danmu, danmu, authorHash, fontsize, color, mode, ctime, idStr, weight, progress: (progress || 0),
                            time: parseTime(progress || 0),
                        };
                    });
                    const data = this.sortJSONByTime(targetData);
                    this.segmentDanmuList[segmentIndex - 1] = data;
                    const currentFullList = this.segmentDanmuList.reduce((res, segment) => {
                        return res.push(...segment), res;
                    }, []);
                    const danmuJSON = {
                        count: currentFullList.length,
                        list: currentFullList,
                        cid: oid,
                    };
                    this.orderedJSON = {...danmuJSON};

                    this.setState({
                        danmuJSON: danmuJSON,
                        loaded: true,
                        loading: false,
                        currentCid: oid,
                    }, () => {
                        let xmlStr = `<?xml version="1.0" encoding="UTF-8"?><i><chatserver></chatserver><chatid>${oid}</chatid><mission></mission><maxlimit></maxlimit><state></state><real_name></real_name><source></source>`;
                        this.danmuDocumentStr = currentFullList.reduce((xml, line) => {
                            const {danmu, authorHash, mode, progress, fontsize, color, ctime, idStr, weight} = line;
                            return xmlStr += `<d p="${(progress || 0) / 1000},${mode},${fontsize},${color},${ctime},${weight},${authorHash},${idStr}">${encodeHTMLEntries(danmu)}</d>`;
                        }, xmlStr) + '</i>';
                        resolve(true);
                    });
                });
            }).then(hasMore => {
                if (hasMore && segmentIndex < this.segmentSize) {
                    return this.getDanmuData(oid, pid, segmentIndex + 1);
                }
            })
        };

        getVideoInitialData = () => {
            return new Promise((resolve, reject) => {
                this.injectScript(`
                    (()=>{
                        if (window.__INITIAL_STATE__ && window.__INITIAL_STATE__.epInfo) {
                            const pid = window.__INITIAL_STATE__.epInfo.aid;
                            const oid = window.__INITIAL_STATE__.epInfo.cid;
                            window.postMessage({command: 'setVideoInitialData', pid, oid}, '*');
                        }
                    })();
                `, 5000);
                const messageCallback = (event) => {
                    const {data} = event;
                    if (data.command === 'setVideoInitialData') {
                        window.removeEventListener('message', messageCallback);
                        data ? resolve(data) : reject();
                    }
                };
                window.addEventListener('message', messageCallback);
            });
        };

        getVideoDuration = () => {
            return new Promise((resolve, reject) => {
                window.postMessage({command: 'getVideoDuration'}, '*');
                this.injectScript(`
                    (()=>{
                        const messageCallback = (event) => {
                            const {data} = event;
                            if (data.command === 'getVideoDuration') {
                                console.log(window.player.getDuration());
                                window.postMessage({command: 'setDuration', duration: window.player.getDuration()}, '*');
                                window.removeEventListener('message', messageCallback);
                            }
                        };
                        window.addEventListener('message', messageCallback);
                    })()
                `, 5000);
                const messageCallback = (event) => {
                    const {data} = event;
                    if (data.command === 'setDuration') {
                        window.removeEventListener('message', messageCallback);
                        data.duration ? resolve(data.duration) : reject();
                    }
                };
                window.addEventListener('message', messageCallback);
            });
        };

        injectScript = (script, clearTimeout = 0) => {
            const dom = document.createElement('script');
            dom.innerHTML = script;
            document.body.appendChild(dom);
            clearTimeout && setTimeout(() => {
                dom.remove();
            }, clearTimeout);
        };

        // 获取弹幕xml数据源
        getDANMUList = (cid, date) => {
            if (!!cid && !this.state.loading) {
                const {list, historyList} = apis;
                const timer = setTimeout(() => { // 请求时长超过800毫秒则显示查询中
                    this.setState({
                        loading: true,
                        loadingText: '弹幕加载中~(๑•̀ㅂ•́)و',
                    });
                }, 800);
                const url = new Url(date ? historyList : list);
                url.set('query', {
                    oid: cid,
                    type: 1,
                    date,
                });
                chrome.runtime.sendMessage({command: 'fetchDanmu', url: url.toString()}, (danmuDocumentStr) => {
                    clearTimeout(timer);
                    if (danmuDocumentStr) {
                        if (date) {
                            this.danmuDate = date;
                        }
                        const oSerializer = new DOMParser();
                        this.danmuDocumentStr = danmuDocumentStr;
                        this.danmuDocument = oSerializer.parseFromString(danmuDocumentStr, 'application/xml');
                        const danmuJSON = this.danmuDocument2JSON(this.danmuDocument);
                        danmuJSON.list = this.sortJSONByTime(danmuJSON.list);
                        this.orderedJSON = {...danmuJSON};
                        this.setState({
                            danmuJSON: danmuJSON,
                            loaded: true,
                            loading: false,
                            currentCid: cid,
                        });
                    } else {
                        this.setState({loadingText: '弹幕加载失败!请刷新页面！'});
                    }
                });
            }
        };

        // 通过uid获取用户信息
        getUserInfoByUid = (uid) => {
            return new Promise((resolve) => {
                const url = new Url(apis.card);
                url.set('query', {mid: uid, photo: 1});
                uid && chrome.runtime.sendMessage({command: 'fetchDanmu', url: url.toString()}, (res) => {
                    if (res) { // 过滤掉可能是机器人的用户
                        const {code, data} = JSON.parse(res);
                        if (code === 0) {
                            if (this.isRobotUser(data)) {
                                resolve(false);
                            }
                            const {card, space, follower, following} = data;
                            this.userMap[uid] = {...card, ...space, follower, following};
                            resolve(uid);
                        } else {
                            console.error(res);
                            this.setState({loadingText: '查询失败!'}, () => { // 查询失败3秒后关闭错误信息
                                setTimeout(() => this.setState({loading: false}), 3000);
                            });
                            resolve(false);
                        }
                    } else {
                        console.error(res);
                        this.setState({loadingText: '查询失败!'}, () => { // 查询失败3秒后关闭错误信息
                            setTimeout(() => this.setState({loading: false}), 3000);
                        });
                        resolve(false);
                    }
                });
            });
        };

        // 检查机器人用户
        isRobotUser = (userData = {}) => {
            const {card} = userData;
            const {level_info} = card;
            const {current_level} = level_info; // 当前用户等级
            //const {type} = official_verify; // 正式用户!?(･_･;?
            return current_level === 0;
        };

        // 将弹幕数据以时间顺序排序
        sortJSONByTime = (originJSON, key = 'time') => {
            return _.sortBy(originJSON, key);
        };

        // 将xml文档转化为json
        danmuDocument2JSON = (document) => {
            const list = [];
            _.forEach(document.getElementsByTagName('d'), (d) => {
                const [
                    time, danmuMode, fontSize, color, unixTime,
                    unknow, // eslint-disable-line
                    authorHash, rowId,
                ] = d.getAttribute('p').split(',');
                let danmuString = d.innerHTML.replace(/[\n\r]/g, '');
                let danmu = danmuString;
                try {
                    danmu = JSON.parse(danmu);
                    if (!(danmu instanceof Array)) {
                        danmu = danmuString;
                    } else {
                        danmu = danmu[4];
                    }
                } catch (e) {
                    e;
                }
                list.push({danmuMode, fontSize, color, unixTime, authorHash, rowId, danmu, time: parseTime(time * 1000)});
            });
            this.setState({loaded: true});
            return {
                cid: Number(document.getElementsByTagName('chatid')[0].innerHTML),
                count: list.length,
                list,
            };
        };

        /**
         * 等级行号动态获取行高
         * 当查询发送者后，可能会出现多解导致显示多行从而改变行高
         * @param index
         * @return {number}
         */
        getRowHeight = ({index}) => {
            const {danmuJSON} = this.state;
            const danmuData = danmuJSON.list[index];
            const uidArray = this.authorHashMap[danmuData.authorHash];
            return (uidArray && uidArray.length * 20) || 20;
        };

        // 搜索框编辑事件
        handleInputChange = (e) => {
            const value = e.target.value;
            const {danmuJSON} = this.state;
            const {cid} = danmuJSON;
            if (!e.target.value) {
                const {count, list} = this.orderedJSON;
                this.setState({danmuJSON: {cid, count, list}});
            } else {
                const list = [];
                _.forEach(this.orderedJSON.list, (data) => {
                    const index = data.danmu.indexOf(value);
                    if (index >= 0) {
                        // 这里一定要复制一份，不然会修改原数据
                        const split = data.danmu.split(value);
                        const danmu = split.reduce((res, v, index) => {
                            if (index < split.length) {
                                res.push(v, <span className="target-words">{value}</span>);
                                return res;
                            }
                        }, []);
                        list.push({...data, danmu});
                    }
                });
                this.setState({danmuJSON: {cid, count: list.length, list}});
            }
        };

        // 当点击没有查询过用户名的弹幕列表行时触发
        handleDanmuLineClick = (authorHash) => {
            let extracted = /^b(\d+)$/.exec(authorHash);
            let uids = [];
            if (extracted && extracted[1]) {
                uids = [extracted[1]];
            } else {
                uids = crcEngine.crack(authorHash);
            }
            this.setState({
                loading: true,
                loadingText: '努力查询中~(๑•̀ㅂ•́)و',
            });
            let thisHashMap = [];
            Promise.all(uids.map((uid) => this.getUserInfoByUid(uid))).then((res) => {
                thisHashMap = thisHashMap.concat(_.compact(res));
            }).then(() => {
                if (thisHashMap.length > 0) {
                    this.authorHashMap[authorHash] = thisHashMap;
                }
                this.setState({loading: false}, () => {
                    this.danmuListRef.recomputeRowHeights();
                    this.danmuListRef.forceUpdate();
                });
            });
        };

        // 当点击查询过用户名的弹幕行时
        handleAuthorClick = (index, uids) => {
            if (!this.state.queryUserMode) {
                const queryList = [];
                this.queryUserModeTemplateMap = {...this.state.danmuJSON}; // 保存当前查询列表
                _.each(uids, (uid) => {
                    const authorHash = _.findKey(this.authorHashMap, (id) => !!~id.indexOf(uid));
                    _.each(this.orderedJSON.list, (data) => {
                        if (data.authorHash === authorHash) {
                            queryList.push({...data}); // 这里一定要复制一份，不然会修改原数据
                        }
                    });
                });
                this.setState({
                    queryUserMode: true,
                    danmuJSON: {cid: this.orderedJSON.cid, count: queryList.length, list: queryList},
                }, () => {
                    this.currentRowIndex = index;
                });
            } else {
                this.setState({
                    queryUserMode: false,
                    danmuJSON: this.queryUserModeTemplateMap,
                }, () => {
                    this.danmuListRef.scrollToRow(this.currentRowIndex);
                });
            }
        };

        handleDownloadClick = (type) => {
            chrome.runtime.sendMessage({
                command: type === 'ass' ? 'downloadDanmuASS' : 'downloadDanmuXML',
                cid: this.state.currentCid,
                danmuDocumentStr: this.danmuDocumentStr,
                danmuJSON: this.orderedJSON,
                date: this.danmuDate,
                filename: getFilename(document),
                origin: type === 'ass' ? document.location.href : null,
            });
        };

        handleOnClickLoadDanmu = () => {
            new Promise((resolve) => {
                if (!this.currentPid || !this.currentOid) {
                    this.getVideoInitialData().then(({oid, pid}) => {
                        this.currentOid = oid;
                        this.currentPid = pid;
                        resolve();
                    });
                } else {
                    resolve();
                }
            }).then(() => {
                this.setState({
                    loading: true,
                    loadingText: '弹幕加载中~(๑•̀ㅂ•́)و',
                    needLoadByHandle: false,
                }, () => {
                    this.getNewDANMUList(this.currentOid, this.currentPid).then(() => {
                        return this.getDanmuData(this.currentOid, this.currentPid, 1);
                    });
                });
            }).catch((reason) => console.error(reason));
        };

        createCardDOM = (data) => {
            if (!data) {
                return console.error('no user data to create card');
            }
            const {mid, face, s_img, name, sign, sex, level_info, following} = data;
            let card, header, container, faceBlock, userBlock, nameBlock, signBlock, levelBlock, sexBlock, btnBlock, likeBtn, messageBtn;

            header = document.querySelector('.helper-card-header') || document.createElement('div');
            container = document.querySelector('.helper-card-container') || document.createElement('div');
            faceBlock = document.querySelector('.helper-card-face') || document.createElement('img');
            userBlock = document.querySelector('.helper-card-user') || document.createElement('p');
            nameBlock = document.querySelector('.helper-card-name') || document.createElement('a');
            signBlock = document.querySelector('.helper-card-sign') || document.createElement('p');
            levelBlock = document.querySelector('.helper-card-level') || document.createElement('a');
            sexBlock = document.querySelector('.helper-card-sex') || document.createElement('i');
            btnBlock = document.querySelector('.helper-card-feed') || document.createElement('div');
            likeBtn = document.querySelector('.helper-card-like-btn') || document.createElement('a');
            messageBtn = document.querySelector('.helper-card-like-btn') || document.createElement('a');
            card = document.querySelector('#helper-card');
            if (!card) {
                card = document.createElement('div');
                header.setAttribute('class', 'helper-card-header bg');
                container.setAttribute('class', 'helper-card-container info');
                faceBlock.setAttribute('class', 'helper-card-face face');
                userBlock.setAttribute('class', 'helper-card-user user');
                nameBlock.setAttribute('class', 'helper-card-name name');
                nameBlock.setAttribute('target', '_blank');
                signBlock.setAttribute('class', 'helper-card-sign sign');
                btnBlock.setAttribute('class', 'helper-card-btn btn-box');
                card.setAttribute('id', 'helper-card');
                card.setAttribute('class', 'user-card');
                levelBlock.setAttribute('class', 'helper-card-level level');
                levelBlock.setAttribute('href', '//www.bilibili.com/html/help.html#k_2');
                levelBlock.setAttribute('target', '_blank');
                likeBtn.setAttribute('class', 'like');
                likeBtn.innerHTML = '<span class="hover-text">取消关注</span><span class="default-text">+关注</span>';
                messageBtn.setAttribute('class', 'message');
                messageBtn.setAttribute('target', '_blank');
                messageBtn.innerText = '发消息';
                userBlock.appendChild(nameBlock);
                userBlock.appendChild(sexBlock);
                userBlock.appendChild(levelBlock);
                container.appendChild(userBlock);
                container.appendChild(signBlock);
                btnBlock.appendChild(likeBtn);
                btnBlock.appendChild(messageBtn);
                card.appendChild(header);
                card.appendChild(faceBlock);
                card.appendChild(container);
                card.appendChild(btnBlock);
            }
            header.setAttribute('style', `background-image: url(${s_img});`);
            faceBlock.setAttribute('src', face);
            if (sex === '男') {
                sexBlock.setAttribute('class', 'sex man');
            } else if (sex === '女') {
                sexBlock.setAttribute('class', 'sex woman');
            }
            const levelInner = document.createElement('i');
            levelInner.setAttribute('class', `level l${level_info.current_level}`);
            levelBlock.innerHTML = '';
            levelBlock.appendChild(levelInner);
            likeBtn.setAttribute('mid', mid);
            likeBtn.setAttribute('uname', name);
            likeBtn.onclick = function() {
                if (following) {
                    this.userMap[mid].following = false;
                } else {
                    this.userMap[mid].following = true;
                }
            };
            if (following) {
                likeBtn.setAttribute('class', 'like liked');
            }

            messageBtn.setAttribute('href', '//message.bilibili.com/#whisper/mid' + mid);
            nameBlock.innerText = name;
            nameBlock.setAttribute('href', 'https://space.bilibili.com/' + mid);
            signBlock.innerText = sign;
            return card;
        };

        createCard = (target, mid) => {
            const userData = this.userMap[mid];
            const cardDOM = this.createCardDOM(userData);
            if (!document.querySelector('#helper-card')) {
                document.querySelector('body').appendChild(cardDOM);
            }

            this.setTargetPosition(target, cardDOM);
        };

        setTargetPosition = (targetDOM, cardDOM) => {
            const {height, top, left} = targetDOM.getBoundingClientRect();
            const {height: cardHeight} = cardDOM.getBoundingClientRect();
            if (cardHeight) {
                this.lastHeight = cardHeight;
            }
            if (top >= cardHeight) {
                cardDOM.style.top = `${top - this.lastHeight - 2}px`;
            } else {
                cardDOM.style.top = `${top + height + 2}px`;
            }
            if (left + 377 <= window.innerWidth) {
                cardDOM.style.left = `${left}px`;
            } else {
                cardDOM.style.left = `${window.innerWidth - 377}px`;
            }
        };

        renderHeader = (danmuJSON = this.state.danmuJSON) => (
            <Title>
                <span>弹幕发送者查询{danmuJSON.count ? <span className="count">{danmuJSON.count} 条</span> : null}</span>
                <DownloadBtn title="下载 ASS 格式弹幕文件" onClick={() => this.handleDownloadClick('ass')}>ASS</DownloadBtn>
                <DownloadBtn title="下载 XML 格式弹幕文件" onClick={() => this.handleDownloadClick('xml')}>XML</DownloadBtn>
            </Title>
        );

        renderLine = ({index, style}) => {
            const {danmuJSON} = this.state;
            const danmuData = danmuJSON.list[index];
            const {rowId, danmu, authorHash, time} = danmuData;
            const uidArray = this.authorHashMap[authorHash];
            let authorNames = _.map(uidArray, (uid) => this.userMap[uid] ? this.userMap[uid].name : '');
            return (
                <DanmuListLine
                    key={rowId}
                    title={`[${time}] ${danmu} ${authorNames ? `by:${authorNames.join(',')}` : ''}`}
                    onClick={() => uidArray ? this.handleAuthorClick(index, uidArray) : this.handleDanmuLineClick(authorHash)}
                    hasQueried={!_.isEmpty(authorNames)}
                    style={style}
                >
                    <span className="time">{time}</span>
                    <span className="danmu">{danmu}</span>
                    <span className="author">
                    {authorNames.map((name, index) => (
                        <div key={name} helper-data-usercard-mid={uidArray[index]}>{name}</div>))}
                </span>
                </DanmuListLine>
            );
        };

        renderList = () => <DanmuList
            ref={i => this.danmuListRef = i}
            width={418}
            height={200}
            rowCount={this.state.danmuJSON.list.length}
            rowHeight={this.getRowHeight}
            rowRenderer={this.renderLine}
            noRowsRenderer={() => (<DanmuListLine>无数据</DanmuListLine>)}
            scrollToAlignment={'center'}
        />;

        render() {
            const {needLoadByHandle, loading} = this.state;
            return (
                <React.Fragment>
                    {this.renderHeader()}
                    {!needLoadByHandle && this.renderList()}
                    {needLoadByHandle && <UnloadList>
                        <button onClick={this.handleOnClickLoadDanmu}>点击加载完整弹幕</button>
                    </UnloadList>}
                    <DanmuSearchInput placeholder="请输入需要查询的弹幕内容" onChange={this.handleInputChange}/>
                    {loading && <LoadingMask>{this.state.loadingText}</LoadingMask>}

                </React.Fragment>
            );
        }
    };
}


/**
 * Author: DrowsyFlesh
 * Create: 2018/11/10
 * Description:
 */

import _ from 'lodash';
import React from 'react';
import ReactDOM from 'react-dom';
import UIBuilder from './DynamicBox';
import {UI} from 'Libs/UI';

export class DynamicCheckUI extends UI {
    constructor() {
        super({
            name: 'dynamicCheck',
            dependencies: ['popupAnchor'],
        });
    }

    load = ([popupDOM], settings) => {
        if (!settings.on) return Promise.resolve();
        return new Promise(resolve => {
            const DynamicBox = UIBuilder();
            const dynamicCheckBoxState = _.find(settings.options, ({key}) => key === 'dynamicCheckBox');
            const dynamicBvToggleState = _.find(settings.options, ({key}) => key === 'bvToggle');
            chrome.runtime.sendMessage({command: 'updateLastDynamicId'});
            chrome.browserAction.setBadgeText({text: ''}); // 不管ui是否加载，只要功能开着，打开菜单都会清理badge
            if (dynamicCheckBoxState.on) {
                const wrapper = document.createElement('div');
                wrapper.setAttribute('class', 'bilibili-helper-dynamic-check-container');
                popupDOM.appendChild(wrapper);
                ReactDOM.render(
                    <DynamicBox ref={i => this.container = i} useBvid={dynamicBvToggleState ? dynamicBvToggleState.on : false}/>,
                    wrapper,
                    () => resolve(this.container),
                );
            } else resolve(null);
        });
    };
}

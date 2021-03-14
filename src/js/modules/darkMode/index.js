/**
 * Author: Cotch22
 * Create: 2020/7/26
 * Description:
 */

import {Feature} from 'Libs/feature';
import {__} from 'Utils/functions';
export {DarkModeUI, VideoDarkBtnUI} from './UI/index';

export class DarkMode extends Feature {
    constructor() {
        super({
            name: 'darkMode',
            kind: 'global',
            settings: {
                on: false,
                hasUI: true,
                title: __('darkMode_name'),
                description:__('darkMode_description'),
                type: 'checkbox',
                options: [
                    {
                        key: 'darkFollowSys',
                        on: false,
                        title: __('darkMode_follow_system'),
                    },
                ],
            },
        });
    }
}

export class VideoDarkBtn extends Feature {
    constructor() {
        super({
            name: 'videoDarkBtn',
            kind: 'video',
            dependencies: ['videoAnchor'],
            settings: {
                on: true,
                hide: true,
                hasUI: true,
            },
        });
    }
}

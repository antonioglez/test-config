/* eslint-disable func-names */
/* eslint-disable consistent-return */
/* eslint-disable no-else-return */
/* eslint-disable new-cap */
/* eslint-disable no-shadow */
/* eslint-disable no-unused-vars */
/* eslint-disable prefer-const */
/* eslint-disable no-underscore-dangle */
/* eslint-disable no-param-reassign */
/* eslint-disable no-undef */
/* eslint-disable no-sequences */

import {
  klass,
  util,
  // MediaConstants, PlayerConstants
} from '@accedo/xdk-core';

import AVPlayerOrig from '@accedo/xdk-device-samsung-tizen/esm/player/AVPlayer';

const AVPlayer = klass.create(
  AVPlayerOrig,
  {
    SINGLE_PLAYER_ONLY: true,
    PRELOADABLE: false,
  },
  {
    __PLAYER_STATE: {
      NONE: 'none',
      IDLE: 'idle',
      READY: 'ready',
      PLAYING: 'playing',
      PAUSED: 'paused',
    },
    __id: null,
    __prepared: false,
    __preparing: false,
    __loaded: false,
    __connected: false,
    __connectionTimeLimit: 90,
    __bufferingTimeLimit: 10,
    __currentTime: 0,
    __playbackSpeed: 1,
    __withholdPlay: false,
    __withholdStop: false,
    __seekTime: 0,
    __protocol: null,
    __mediaOption: null,
    __url: null,
    __drm: null,
    _extensionManager: null,
    __isPendingPlay: false,
    __secondToPlay: null,
    __doLoadPromise: null,
    __playerConfig: null,

    prepare(option) {
      // prepare
      this.__subtitleContainer = this._createSubtitleContainer();
      this.__subtitleText = this._createSubtitleText();
      this.__showingSubtitle = false;
      this.__subtitleContainer.appendChild(this.__subtitleText);
      this.__subtitlesTimer = null;

      this._super(option);

      this.__parentNode.appendChild(this.__subtitleContainer);
    },

    // TODO
    _createSubtitleContainer() {
      const e = document.createElement('div');
      return (
        e.setAttribute('style', 'visibility:hidden;'),
        e.setAttribute('id', 'av-player-subtitles-container'),
        e.setAttribute('class', 'avplayer internal-subtitle'),
        e
      );
    },

    // TODO
    _createSubtitleText() {
      const e = document.createElement('div');
      return e.setAttribute('class', 'text'), e.setAttribute('id', 'av-player-subtitles-text'), e;
    },

    // TODO
    __showSubtitleContainer(enable) {
      if (enable) {
        this.__showingSubtitle = true;
        this.__subtitleContainer.setAttribute('style', 'visibility:visible;');
        return;
      }
      this.__showingSubtitle = false;
      this.__subtitleContainer.setAttribute('style', 'visibility:hidden;');
    },

    __onSubtitleCallback(duration, text) {
      info(`__onSubtitleCallback: duration: ${duration}, text: ${text}`);

      this.dispatchEvent(PLAYER_EVENT.SUBTITLE_UPDATE, {
        duration,
        text,
      });

      clearTimeout(this.__subtitlesTimer);

      // TODO
      this.updateSubtitles(text);
      // the e param is the length of time to display the subtitle for in milliseconds
      // create a basic setTimeout upon which to set the contents of the div to "" (empty)
      // there is a .text:empty selector in tizen.scss which then sets the div to display:none
      this.__subtitlesTimer = setTimeout(() => {
        if (this.__isState(this.__PLAYER_STATE.PLAYING)) {
          this.clearSubtitles();
        }
      }, e);
    },

    reset() {
      this._super();
      this.__parentNode.removeChild(this.__subtitleContainer);
      this.__subtitleContainer = null;
      this.__subtitleText = null;
      clearTimeout(this.__subtitlesTimer);
      this.__subtitlesTimer = null;
    },

    __doLoad(mediaUrl, option) {
      mediaUrl = mediaURL.replace('https', 'http');
      this._super(mediaUrl, option);
    },

    __getMediaUrlWithProtocolIfApplies(mediaURL) {
      const isProtocolRelativeUrl = util.isProtocolRelative(mediaURL);
      let mediaUrlWithProtocol = mediaURL;

      if (isProtocolRelativeUrl) {
        mediaUrlWithProtocol = util.protocolRelativeToAbsolute(mediaURL);
      }

      mediaUrlWithProtocol = mediaUrlWithProtocol.replace('https', 'http');
      console.log(`Loading URL: ${mediaUrlWithProtocol}`);

      return mediaUrlWithProtocol;
    },

    __onFinished() {
      this.clearSubtitles();
      this.__showSubtitleContainer(false);
      this._super();
    },

    __stopPlayback() {
      this.clearSubtitles();
      this.__showSubtitleContainer(false);
      this._super();
    },

    seek(seconds) {
      clearTimeout(this.__subtitlesTimer);
      this.clearSubtitles();
      this._super(seconds);
    },

    setVideoSizeAndPosition(param) {
      webapis?.avplay?.setDisplayMethod('PLAYER_DISPLAY_MODE_FULL_SCREEN');
      this._super(param);
    },
    showSubtitles() {
      this.__showSubtitleContainer(true);
      this.redrawSubtitles();
    },

    // TODO
    // hide the subtitlesContainer div
    hideSubtitles() {
      this.__showSubtitleContainer(false);
    },

    // TODO
    // set the contents of the subtitleText div to "" (empty)
    clearSubtitles() {
      this.updateSubtitles('');
    },

    // TODO
    // set the contents of the subtitleText div
    updateSubtitles(t) {
      if (this.__subtitleText) {
        this.__subtitleText.innerHTML = t;

        if (this.__showingSubtitle) {
          this.redrawSubtitles();
        }
      }
    },

    // TODO
    // ensures subtitleText element is displayed, or hidden if text is ""
    redrawSubtitles() {
      if (this.__subtitleText) {
        this.__subtitleText.style.display = 'none';

        if (this.__subtitleText.innerHTML.length > 0) {
          this.__subtitleText.style.display = 'inline';
        }
      }
    },

    doRestore({ url: urlOrig, option }) {
      const url = urlOrig.replace('https', 'http');

      this._super({ url, option });
    },
  }
);

export default AVPlayer;

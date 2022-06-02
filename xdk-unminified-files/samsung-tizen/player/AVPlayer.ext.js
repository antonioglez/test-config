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
/**
 * The AVPlayer using webapis.avplay which is the tizen player supported by
 * Samsung. It provides video playback and support various DRMs and encryption.
 * @class samsung-tizen/player/AVPlayer
 */
import logger from '@accedo/xdk-log';
import xdk, {
  klass,
  core,
  error,
  IPlayer,
  util,
  Environment,
  EventDispatcher,
  promise,
  MediaExtensionManager,
  MediaExtensionConstants,
  MediaConstants,
  PlaybackErrorConstants,
  PlayerConstants,
} from '@accedo/xdk-core';

import * as avplayProxy from '@accedo/xdk-device-samsung-tizen/esm/avplayProxy';
import AVPlayerOrig from '@accedo/xdk-device-samsung-tizen/esm/player/AVPlayer';

const { logError, warn, info, debug } = logger({
  logTag: `[samsung-tizen/AVPlayer]`,
});

const { DRM: DRM_EXTENSION, SUBTITLE: SUBTITLE_EXTENSION } = MediaExtensionConstants.TYPE;
const { BUFFERING, DEFAULT_PARENT_NODE, EVENT: PLAYER_EVENT } = PlayerConstants;
const {
  DRM: { AES_128, PLAYREADY, WIDEVINE },
  PROTOCOL: { DASH, HLS, PROGRESSIVE, SMOOTH_STREAMING },
} = MediaConstants;

let resolution = null;
const getScreen = (dimension) =>
  tizen.systeminfo.getCapability(`http://tizen.org/feature/screen.${dimension}`);
const getResolution = () => {
  if (!resolution) {
    resolution = {
      width: getScreen('width'),
      height: getScreen('height'),
    };
  }

  return resolution;
};

const system = () => {
  const { system } = xdk;

  if (!system) {
    warn('AVPlayer trying to control screensaver without system.');
  }

  return system;
};

const screenSaverOn = () => system()?.screenSaverOn();
const screenSaverOff = () => system()?.screenSaverOff();

let sEnv;
const AVPlayer = klass.create(
  AVPlayerOrig,
  {
    SINGLE_PLAYER_ONLY: true,
    PRELOADABLE: false,
  },
  {
    init(playerConfig, extensionManager) {
      this._extensionManager = extensionManager;

      if (playerConfig) {
        debug('get the config');
        this.__playerConfig = playerConfig;

        this.__connectionTimeLimit =
          playerConfig['connection-timeout'] || this.__connectionTimeLimit;
        this.__bufferingTimeLimit = playerConfig['buffering-timeout'] || this.__bufferingTimeLimit;
      }

      sEnv = Environment.singleton();

      if (!webapis || !webapis.avplay) {
        throw new error.IllegalState('Fail to load the AVPlayer API.');
      }
    },

    /**
     * To prepare the video and create the drm agent if necessary.
     * @method prepare
     * @param {Object}  [option]  extra parameter needed for the URL
     * @memberof samsung-tizen/player/AVPlayer#
     * @public
     */
    prepare(option) {
      if (this.__prepared) {
        return;
      }

      // NOTE: Until XDK pseudo-interface implementation is removed.
      // We cannot use ES6 default parameter as it will be transpiled
      // into a function that will failed pseudo-interface runtime test.
      option = option || {};

      if (!option.parentNode) {
        option.parentNode = DEFAULT_PARENT_NODE;
      }

      this.__parentNode = option.parentNode;

      // Prepare for the player object.
      this.__playerObject = this.__createPlayerObject();

      this.__parentNode.appendChild(this.__playerObject);
      this.__parentNode.appendChild(this.__playerObjectVideo);

      // TODO
      this.__subtitleContainer = this._createSubtitleContainer();
      this.__subtitleText = this._createSubtitleText();
      this.__showingSubtitle = false;
      this.__subtitleContainer.appendChild(this.__subtitleText);
      this.__parentNode.appendChild(this.__subtitleContainer);
      this.__subtitlesTimer = null;

      this.__prepared = true;

      // Handle the player suspend and restore.
      sEnv.addEventListener(sEnv.SYSTEM.RESUME, this.__handleResume);
      sEnv.addEventListener(sEnv.SYSTEM.SUSPEND, this.__handlePause);

      // If extension manager is removed in reset, we have to prepare it.
      if (!this._extensionManager && this.__playerConfig) {
        this._extensionManager = new MediaExtensionManager(this.__playerConfig.extensions);
      }
    },

    __createPlayerObject() {
      const avPlayerObject = document.createElement('object');

      avPlayerObject.setAttribute('id', 'av-player');
      avPlayerObject.setAttribute('type', 'application/avplayer');
      //    avPlayerObject.setAttribute('style', 'width:100%;height:100%;');

      return avPlayerObject;
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

    reset() {
      this.__preparing = false;
      if (!this.__prepared) {
        return;
      }

      this.__prepared = false;
      this.__hide();
      this.__parentNode.removeChild(this.__playerObject);
      this.__playerObject = null;
      // TODO
      this.__parentNode.removeChild(this.__subtitleContainer);
      this.__subtitleContainer = null;
      this.__subtitleText = null;
      clearTimeout(this.__subtitlesTimer);
      this.__subtitlesTimer = null;

      this.__connected = false;
      this.__loaded = false;
      this.__currentTime = 0;
      this.__playbackSpeed = 1;
      this.__withholdPlay = false;
      this.__seekTime = 0;
      this.__protocol = null;
      this.__mediaOption = null;
      this.__url = null;
      this.__drm = null;
      this.__isPendingPlay = false;
      this.__secondToPlay = null;
      this.__doLoadPromise = null;

      sEnv.removeEventListener(sEnv.SYSTEM.RESUME, this.__handleResume);
      sEnv.removeEventListener(sEnv.SYSTEM.SUSPEND, this.__handlePause);

      if (this._extensionManager) {
        this._extensionManager.deinit();
      }
      this._extensionManager = null;

      screenSaverOn();
    },

    __doLoad(mediaURL, option) {
      debug(`player.__doLoad: invoked: ${mediaURL}`);

      if (!this.__doLoadPromise) {
        debug('player.__doLoad: Create a new doLoad Promise.');
        this.__doLoadPromise = this.__newDoLoadPromise(mediaURL, option);
      }

      return this.__doLoadPromise.complete(
        util.bind(function () {
          debug('player.__doLoad: Clearing doLoad reference.');
          this.__doLoadPromise = null;
        }, this)
      );
    },

    /**
     * Get the Media Url adding the proper http(s) protocol to allow playback
     *
     * @method __getMediaUrlWithProtocolIfApplies
     * @returns {string} the mediaUrl updated or not
     * @private
     */
    __getMediaUrlWithProtocolIfApplies(mediaURL) {
      const isProtocolRelativeUrl = util.isProtocolRelative(mediaURL);
      let mediaUrlWithProtocol = mediaURL;

      if (isProtocolRelativeUrl) {
        mediaUrlWithProtocol = util.protocolRelativeToAbsolute(mediaURL);
      }

      console.log(`Loading URL: ${mediaUrlWithProtocol}`);

      return mediaUrlWithProtocol;
    },

    load(mediaURL, option) {
      let operationResult;

      if (!this.__prepared) {
        return false;
      }

      if (
        this.__isState(this.__PLAYER_STATE.PLAYING) ||
        this.__isState(this.__PLAYER_STATE.PAUSED)
      ) {
        this.stop();
      }

      if (option.parentNode && this.__parentNode !== option.parentNode) {
        this.__parentNode.removeChild(this.__playerObject);
        this.__parentNode = option.parentNode;
        this.__parentNode.appendChild(this.__playerObject);
      }

      console.log(option);

      const mediaUrlWithProtocol = this.__getMediaUrlWithProtocolIfApplies(mediaURL);

      debug(`[debug] mediaUrlWithProtocol: ${mediaUrlWithProtocol}`);

      this.__url = mediaUrlWithProtocol;
      this.__mediaOption = option;
      this.__connected = false;

      this.__protocol = option.protocol || null;
      this.__drm = option.drm || null;

      this.__hide();

      this.__doLoad(mediaUrlWithProtocol, option)
        .then(
          util.bind(function () {
            operationResult = avplayProxy.setTimeoutForBuffering(this.__bufferingTimeLimit);
            info(`set timeout for buffering result: ${operationResult}`);

            this.__loaded = true;

            if (this.__isPendingPlay) {
              info(
                'Pending Play is triggered (by the Player Event using the State machine) after load is done.'
              );
              info(`[AVPlay] load FORCE_PLAY`);
              this.dispatchEvent(PLAYER_EVENT.FORCE_PLAY, this.__secondToPlay);
              this.__isPendingPlay = false;
              this.__secondToPlay = null;
            }
          }, this)
        )
        .done();
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

    __onFinished() {
      // TODO
      this.clearSubtitles();
      this.__showSubtitleContainer(false);

      info('__onFinished');
      this.__stopPlayback();

      this.dispatchEvent(PLAYER_EVENT.FINISHED);
    },

    __stopPlayback() {
      // TODO
      this.clearSubtitles();
      this.__showSubtitleContainer(false);

      let stopResult = avplayProxy.stop();

      info(`Stop playback: ${stopResult}`);

      screenSaverOn();

      this.__hide();

      // Reset the witholdPlay flag to avoid the video to be played when
      // buffering complete.
      this.__withholdPlay = false;

      // Raise the withholdStop flag to avoid __prepareSuccess from
      // beginning to play the video.
      this.__withholdStop = true;

      this.__connected = false;
      this.__loaded = false;
      this.__preparing = false;

      this.__isPendingPlay = false;
      this.__secondToPlay = null;
      this.__doLoadPromise = null;

      return stopResult;
    },

    /**
     * Seek to specific position of the video.
     * Tizen supports:
     *  -32x, -16x, -8x, -4x, -2x, -1x, 1x, 2x, 4x, 8x, 16x, 32x
     * @method seek
     * @param {Number} second the position to seek to in seconds
     * @memberof samsung-tizen/player/AVPlayer#
     */
    seek(second) {
      // TODO
      // when we seek we need to clear out the subtitles so that they don't linger on screen
      clearTimeout(this.__subtitlesTimer);
      this.clearSubtitles();

      let isSpeeding = this.__playbackSpeed > 1;

      // No response when seekTo 0, so convert to second from 0s to 1s,
      // which will be further converted into 1000ms.
      // XDK-2612 Fail to seek time to 0 in asf, so try to standardise
      // all media to 0.5s. The device will start at 0 in fact.
      if (second === 0) {
        second = 0.5;
      }

      // Since it is so strange when seek close to the duration and result
      // in no response, the maximum value for the seek will be a second
      // before the end and then convert the time to ms format.
      second = Math.min(this.getDuration() - 1, second) * 1000;

      // To seek a video, we need to set the playing speed back to 1.
      if (isSpeeding) {
        avplayProxy.setSpeed(1);
      }

      if (avplayProxy.seekTo(second) === avplayProxy.INVALID) {
        logError('Seek failed.');

        return false;
      }

      // Rollback the speeding status.
      if (isSpeeding) {
        avplayProxy.setSpeed(this.__playbackSpeed);
      }

      this.__updateCurrentTime();

      return true;
    },

    /**
     * Sets video window size
     * @method setVideoSizeAndPosition
     * @memberof samsung-tizen/player/AVPlayer#
     * @public
     */
    setVideoSizeAndPosition(param) {
      let innerWidth = core.root.innerWidth || 0;

      let ratio = innerWidth / getResolution().width;

      this.__playerObject.style.left = `${param.left}px`;
      this.__playerObject.style.top = `${param.top}px`;
      this.__playerObject.style.width = `${param.width}px`;
      this.__playerObject.style.height = `${param.height}px`;

      // XDK-3095 since the avplayer is always the same with system
      // resolution and independent of viewport size, set the right size
      // according to the ratio.

      webapis?.avplay?.setDisplayMethod?.('PLAYER_DISPLAY_MODE_AUTO_ASPECT_RATIO');

      console.log(webapis?.avinfo.getVersion());

      avplayProxy.setDisplayRect(
        param.left / ratio,
        param.top / ratio,
        param.width / ratio,
        param.height / ratio
      );
    },

    /**
     * set the video to be full screen
     * @method setFullscreen
     * @memberof samsung-tizen/player/AVPlayer#
     * @public
     */
    setFullscreen() {
      let window = core.root;

      console.log('setFullScreen');

      // XDK-3095 Full screen should be with respect to application
      // size, which may be viewport size or system screen size.
      console.log('window.innerWidth', window.innerWidth);
      console.log('window.screen.width', window.screen.width);

      this.setVideoSizeAndPosition({
        top: 0,
        left: 0,
        height: window.innerHeight,
        width: window.innerWidth,
      });
    },

    // TODO
    // show the subtitlesContainer div
    // showSubtitles() {
    // showExternalSubtitles() {
    //   console.log('showSubtitles external');
    //   this.__showSubtitleContainer(true);
    //   this.redrawSubtitles();
    // },

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
      const url = urlOrig;

      this._super({ url, option });
    },
  }
);

export default AVPlayer;

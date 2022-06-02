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
  EventDispatcher,
  [IPlayer],
  {
    SINGLE_PLAYER_ONLY: true,
    PRELOADABLE: false,
  },
  {
    /**
     * Constant to store Tizen's AVPlayPlayerStates
     * @name __PLAYER_STATE
     * @memberof samsung-tizen/player/AVPlayer#
     * @private
     */
    __PLAYER_STATE: {
      NONE: 'none',
      IDLE: 'idle',
      READY: 'ready',
      PLAYING: 'playing',
      PAUSED: 'paused',
    },
    /**
     * To store the player id
     * @name __id
     * @memberof samsung-tizen/player/AVPlayer#
     * @private
     */
    __id: null,

    /**
     * To store the status whether the object is prepared
     * @name __prepared
     * @memberof samsung-tizen/player/AVPlayer#
     * @private
     */
    __prepared: false,

    /**
     * To store if prepareAsync is currently in progress.
     * @name __preparing
     * @memberof samsung-tizen/player/AVPlayer#
     * @private
     */
    __preparing: false,

    /**
     * To determine whether the avplayer is loaded or not
     * @name __loaded
     * @memberof samsung-tizen/player/AVPlayer#
     * @private
     */
    __loaded: false,

    /**
     * To store the status whether the player is connected
     * @name __connected
     * @memberof samsung-tizen/player/AVPlayer#
     * @private
     */
    __connected: false,

    /**
     * Time out(sec) for the player connection
     * @name __connectionTimeLimit
     * @memberof samsung-tizen/player/AVPlayer#
     * @private
     */
    __connectionTimeLimit: 90,

    /**
     * Time out (sec) for the player buffering
     * @name __bufferingTimeLimit
     * @memberof samsung-tizen/player/AVPlayer#
     * @private
     */
    __bufferingTimeLimit: 10,

    /**
     * player current time
     * @name __currentTime
     * @memberof samsung-tizen/player/AVPlayer#
     * @private
     */
    __currentTime: 0,

    /**
     * player playback speed
     * @name __playbackSpeed
     * @memberof samsung-tizen/player/AVPlayer#
     * @private
     */
    __playbackSpeed: 1,

    /**
     * withhold play
     * @name __withholdPlay
     * @memberof samsung-tizen/player/AVPlayer#
     * @private
     */
    __withholdPlay: false,

    /**
     * Withhold stop, this flag will be raised when stopPlayback is called
     * and reset when play is called. This flag is only being checked within
     * the prepareSuccess handler. Without this flag, prepareSuccess will
     * proceed with playing of a video even when a stop has been requested
     * during the short period of asynchronous prepare.
     *
     * @name __withholdStop
     * @memberof samsung-tizen/player/AVPlayer#
     * @private
     */
    __withholdStop: false,

    /**
     * player seek time
     * @name __seekTime
     * @memberof samsung-tizen/player/AVPlayer#
     * @private
     */
    __seekTime: 0,

    /**
     * Protocol
     * @name __protocol
     * @memberof samsung-tizen/player/AVPlayer#
     * @private
     */
    __protocol: null,

    /**
     * Media options
     * @name __mediaOption
     * @memberof samsung-tizen/player/AVPlayer#
     * @private
     */
    __mediaOption: null,

    /**
     * Media url
     * @name __url
     * @memberof samsung-tizen/player/AVPlayer#
     * @private
     */
    __url: null,

    /**
     * Media's DRM setting
     * @name __drm
     * @memberof samsung-tizen/player/AVPlayer#
     * @private
     */
    __drm: null,

    /**
     * the player extension manager
     * @name _extensionManager
     * @memberof samsung-tizen/player/AVPlayer#
     * @protected
     */
    _extensionManager: null,

    /**
     * flag to check if there is pending play function to be triggered after load
     * @name __isPendingPlay
     * @memberof samsung-tizen/player/AVPlayer#
     * @private
     */
    __isPendingPlay: false,

    /**
     * cache second to play for pendingPlay
     * @name __secondToPlay
     * @memberof samsung-tizen/player/AVPlayer#
     * @private
     */
    __secondToPlay: null,

    /**
     * cache doLoad promise to prevent doLoad being called twice in load or play.
     * @name __doLoadPromise
     * @memberof samsung-tizen/player/AVPlayer#
     * @private
     */
    __doLoadPromise: null,

    /**
     * player config
     * @name __playerConfig
     * @memberof samsung-tizen/player/AVPlayer#
     * @private
     */
    __playerConfig: null,

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
     * Gets the player's config
     * @method getPlayerConfig
     * @returns {Object} the player's configuration
     * @memberof samsung-tizen/player/AVPlayer#
     * @public
     */
    getPlayerConfig() {
      return this.__playerConfig;
    },

    /**
     * To get the capabilities of the player.
     * @method getCapabilities
     * @returns {interfaces/Player~PlayerCapabilities}
     * @memberof samsung-tizen/player/AVPlayer#
     * @public
     */
    getCapabilities() {
      return {
        protocol: [SMOOTH_STREAMING, PROGRESSIVE, HLS, DASH],
        drm: [AES_128, PLAYREADY, WIDEVINE],
      };
    },

    /**
     * To prepare the video and create the drm agent if necessary.
     * @method prepare
     * @param {Object}  [option]  extra parameter needed for the URL
     * @memberof samsung-tizen/player/AVPlayer#
     * @public
     */
    prepare(option) {
      console.log('player.prepare');
      console.log('option', option);
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
      // this.__playerObjectVideo = this.__createPlayerObjectVideo();

      this.__parentNode.appendChild(this.__playerObject);

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

    getVideoSize() {
      const { videoWidth: width, videoHeight: height } = this.__playerObject;

      return { width, height };
    },

    __createPlayerObject() {
      console.log('__createPlayerObject');
      const avPlayerObject = document.createElement('object');

      avPlayerObject.setAttribute('id', 'av-player');
      avPlayerObject.setAttribute('type', 'application/avplayer');
      avPlayerObject.setAttribute('style', 'width:100%;height:100%;');

      return avPlayerObject;
    },

    // __createPlayerObjectVideo() {
    //   console.log('__createPlayerObjectVideo');
    //   const avPlayerObjectVideo = document.createElement('video');

    //   return avPlayerObjectVideo;
    // },

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

    _getPlayerObject() {
      return this.__playerObject;
    },

    /**
     * pause the avplayer when it is suspended.
     * @method __handlePause
     * @private
     * @memberof samsung-tizen/player/AVPlayer#
     */
    __handlePause() {
      return avplayProxy.suspend();
    },

    /**
     * Restore the AVPlayer when the app is resumed. If the player was
     * playing a video when the app went suspended, the player will resume
     * playing the same video, began at the timestamp when the app was
     * suspended.
     *
     * @method __handleResume
     * @private
     * @memberof samsung-tizen/player/AVPlayer#
     */
    __handleResume() {
      // XDK-3406 prioritize UI then restore avplayer state.
      util.defer().then(() => {
        avplayProxy.restore();
      });
    },

    /**
     * resets the video player, to non-playing mode
     * @method
     * @memberof samsung-tizen/player/AVPlayer#
     * @protected
     */
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

    /**
     * The "do-er" function that performs the doLoad action, if the action
     * passed the checks happens in the {@link #load} function.
     *
     * If the {@link #__doLoadPromise} has already been created, its
     * `.complete` cascade will be returned.
     *
     * If the {@link __doLoadPromise} has NOT been created, this function
     * will call {@link __newDoLoadPromise} to create the promise, and
     * its `.complete` cascade will be returned.
     *
     * @method
     * @param {String} mediaURL - The URL of the stream.
     * @param {Object} option - The media options.
     * @returns {module:base/promise~Promise.<T>} - A promise that will be
     * resolved when loading completed, or rejected if loading failed. The
     * private reference, helding by this AVPlayer, will be nullified
     * whenever loading is completed, whether it is resolved or rejected.
     * @memberof samsung-tizen/player/AVPlayer#
     * @private
     */
    __doLoad(mediaURL, option) {
      debug(`player.__doLoad: invoked: ${mediaURL}`);

      if (!this.__doLoadPromise) {
        debug('player.__doLoad: Create a new doLoad Promise.');
        this.__doLoadPromise = this.__newDoLoadPromise(mediaURL.replace('https', 'http'), option);
      }

      return this.__doLoadPromise.complete(
        util.bind(function () {
          debug('player.__doLoad: Clearing doLoad reference.');
          this.__doLoadPromise = null;
        }, this)
      );
    },

    /**
     * Construct a new doLoad promise whenever a this function is called.
     *
     * @constructs doLoadPromise
     * @param {String} mediaURL - The URL of the stream.
     * @param {Object} option - The media options.
     * @memberof samsung-tizen/player/AVPlayer#
     * @private
     */
    __newDoLoadPromise(mediaURL, option) {
      return new promise.promise((resolve, reject) => {
        let operationResult;

        debug('doLoadPromise: Begin...');

        if (!this.__isState(this.__PLAYER_STATE.NONE)) {
          debug('doLoadPromise: Current state is not NONE. Close it first.');

          operationResult = avplayProxy.close();

          if (operationResult === avplayProxy.INVALID) {
            // AVPlayer state machine changed in firmware 1141
            // means calling close too early will cause error
            info('Error occurred due to close being called too early.');
          }

          debug('doLoadPromise: AVPlayer is now closed.');
        }

        debug(`doLoadPromise: Open the mediaURL: ${mediaURL}`);

        operationResult = avplayProxy.open(mediaURL);

        info(`Initialize the player result: ${operationResult}`);

        // Tizen's setListener has no unsetListener counterpart and is
        // safe to be called multiple times.
        operationResult = avplayProxy.setListener({
          onbufferingstart: util.bind(this.__onBufferingStart, this),
          onbufferingprogress: util.bind(this.__onBufferingProgress, this),
          onbufferingcomplete: util.bind(this.__onBufferingComplete, this),
          oncurrentplaytime: util.bind(this.__onCurrentPlayTime, this),
          onstreamcompleted: util.bind(this.__onFinished, this),
          onevent: util.bind(this.__onEventCallback, this),
          onerror: util.bind(this.__onError, this),
          ondrmevent: util.bind(this.__onDRMCallback, this),
          onsubtitlechange: util.bind(this.__onSubtitleCallback, this),
        });

        info(`setListener result: ${operationResult}`);

        this.__prepareDrm(option).then(resolve, reject);
      });
    },

    /**
     * Subroutine of __newDoLoadPromise, which handle the instantiation
     * of DRM Agent only.
     *
     * This function returns native Promise, but because Tizen's
     * remote debugger doesn't support async keyword, this function
     * simply return Promise instead.
     *
     * @param {Object} option Option object from doLoadPromise
     * @returns {Promise} Native Promise.
     */
    __prepareDrm(option) {
      const { drm } = option;

      // No DRM settings are needed for HLS with AES 128 as well.
      if (!drm || drm === AES_128) {
        debug('doLoadPromise: DRM Ext not needed. Job done.');

        return Promise.resolve();
      }

      const { drm: supportedDRM = [] } = this.getCapabilities();

      if (!supportedDRM.includes(drm)) {
        return Promise.reject(new error.IllegalArgument(`DRM '${drm}' is not supported`));
      }

      const { _extensionManager: extMgr } = this;

      if (!extMgr || !extMgr.isExtensionSupported(DRM_EXTENSION)) {
        return Promise.reject(
          new error.UnsupportedOperation('DRM extension is not defined properly.')
        );
      }

      return extMgr
        .getExtension(DRM_EXTENSION)
        .then((extension) => extension.createDRMAgent(drm))
        .then((drmAgent) => drmAgent.prepare(option, avplayProxy));
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

      mediaUrlWithProtocol = mediaUrlWithProtocol.replace('https', 'http');
      console.log(`Loading URL: ${mediaUrlWithProtocol}`);

      return mediaUrlWithProtocol;
    },

    /**
     * To set the URL and load the video.
     * @method load
     * @param {String}  mediaURL  url the URL address of the media
     * @param {Object}  [option]  extra parameter needed for the URL
     * @param {String} [option.drm] DRM technology to use
     * @param {String} [option.type] media container format to use
     * @param {String} [option.drmURL] (PlayReady|Widevine) Set the DRM license URL
     * @param {String} [option.cookie] (PlayReady) Set the COOKIE information for PlayReady
     * @param {String} [option.customData] (PlayReady) to set custom data
     * @param {String} [option.httpHeader] (PlayReady) add custom http header
     * @param {String} [option.soapHeader] (PlayReady) add custom soap header
     * @param {String} [option.deleteLicenseAfterUse] (PlayReady) Enable deletion of license after use.
     * @param {String} [option.userData] (Widevine) Set the user data
     * @param {String} [option.deviceTypeId] (Widevine)the device type id when using widevine
     * @param {String} [option.drmCurTime] (Widevine) cur time param when using widevine
     * @param {String} [option.iSeek] (Widevine) i-seek param when using widevine
     * @param {String} [option.portal] (Widevine)portal param when using widevine
     * @memberof samsung-tizen/player/AVPlayer#
     * @public
     */
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

      // const playObject = {
      //   ...option,
      //   subtitle: [
      //     {
      //       // subtitle play array. must contain one subtitle object per subtitle track
      //       mimetype: 'webvtt',
      //       url: './sintel-en.vtt',
      //       language: 'en',
      //       label: 'english subtitle vtt',
      //     },
      //   ],
      // };

      // this.__doLoad(mediaUrlWithProtocol, playObject)
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

    /**
     * To hide the player.
     * @method __hide
     * @memberof samsung-tizen/player/AVPlayer#
     * @private
     */
    __hide() {
      if (!this.__playerObject) {
        return;
      }
      this.__playerObject.style.visibility = 'hidden';
    },

    /**
     * To show the player.
     * @method __show
     * @memberof samsung-tizen/player/AVPlayer#
     * @private
     */
    __show() {
      if (!this.__playerObject) {
        return;
      }
      this.__playerObject.style.visibility = 'visible';
    },

    /**
     * On buffering start callback.
     * @method __onBufferingStart
     * @memberof samsung-tizen/player/AVPlayer#
     * @private
     */
    __onBufferingStart() {
      info('[XDK AVPlayer] Buffering start');
      this.dispatchEvent(PLAYER_EVENT.BUFFERING, BUFFERING.START);
    },

    /**
     * On buffering progress callback.
     * @method __onBufferingProgress
     * @param {Number} percent the percentage of the buffering progress
     * @memberof samsung-tizen/player/AVPlayer#
     * @private
     */
    __onBufferingProgress(percent) {
      this.dispatchEvent(PLAYER_EVENT.BUFFERING, BUFFERING.PROGRESS, percent);
    },

    /**
     * Buffering complete callback.
     * @method __onBufferingComplete
     * @memberof samsung-tizen/player/AVPlayer#
     * @private
     */
    __onBufferingComplete() {
      // Delay the buffering complete when it is not yet connected.
      this.__delayBufferingComplete = !this.__connected;

      if (!this.__connected) {
        return;
      }

      this.dispatchEvent(PLAYER_EVENT.BUFFERING, BUFFERING.FINISH);
    },

    /**
     * prepareAsync onsuccess handler, which will be fired after the first
     * buffering completed.
     *
     * @method __prepareSuccess
     * @memberof samsung-tizen/player/AVPlayer#
     * @private
     */
    __prepareSuccess() {
      this.__preparing = false;

      info(
        `__prepareSuccess seekTime: ${this.__seekTime}, withholdPlay: ${this.__withholdPlay}, withholdStop: ${this.__withholdStop}`
      );

      if (this.__withholdStop) {
        info('Stop has been requested before prepareAsync finished. Not going to play the stream.');

        return;
      }

      let seekTime = this.__seekTime;

      this.__connected = true;

      if (!util.isUndefined(seekTime) && seekTime >= 0) {
        this.__withholdPlay = true;

        // XDK-2616 Fail to seekTo second in aes-128,
        // use jumpForward instead of seek.
        if (this.__drm === AES_128) {
          avplayProxy.jumpForward(seekTime * 1000);
        } else {
          this.seek(seekTime);
        }

        this.__seekTime = 0;
      }

      // to change the state into buffering complete which is delayed
      if (this.__delayBufferingComplete) {
        this.dispatchEvent(PLAYER_EVENT.BUFFERING, BUFFERING.FINISH);
      }

      if (this.__withholdPlay) {
        this.__withholdPlay = false;
        this.__stopScreenSaverAndPlay();
      }
    },

    /**
     * It will be fired the prepareAsync fail callback.
     * @method __prepareFail
     * @memberof samsung-tizen/player/AVPlayer#
     * @private
     */
    __prepareFail() {
      this.__preparing = false;
      let RENDER_FAILED = PlaybackErrorConstants.ERROR.RENDER.FAILED;

      this.__stopPlayback();

      debug('Failed to prepare the video.');
      this.dispatchEvent(PLAYER_EVENT.ERROR, RENDER_FAILED);
    },

    /**
     * Stop the screensaver regardlessly and trying to play the video. If
     * the player is already in playing state before the play command is
     * issued, no error will be returned.
     *
     * @method __stopScreenSaverAndPlay
     * @memberof samsung-tizen/player/AVPlayer#
     * @private
     * @return {*} Return what {@link samsung-tizen/avplayProxy#play}
     *             can return.
     */
    __stopScreenSaverAndPlay() {
      screenSaverOff();

      if (!this.__isState(this.__PLAYER_STATE.PLAYING)) {
        avplayProxy.play();
      }
    },

    /**
     * The current play time update callback.
     * @method __onCurrentPlayTime
     * @memberof samsung-tizen/player/AVPlayer#
     * @private
     */
    __onCurrentPlayTime(currentTime) {
      this.__currentTime = currentTime / 1000;

      this.dispatchEvent(PLAYER_EVENT.TIME_UPDATE, this.getCurrentTime());
    },

    /**
     * The event callback.
     * @method __onEventCallback
     * @param {String} eventType the type of event
     * @param {String} eventData data of the event
     * @memberof samsung-tizen/player/AVPlayer#
     * @private
     */
    __onEventCallback(eventType, eventData) {
      info(`__onEventCallback: ${eventType}, ${eventData}`);
    },

    /**
     * The subtitle event callback.
     * @method __onSubtitleCallback
     * @param {Number} duration the time
     * @param {String} text of the subtitle
     * @memberof samsung-tizen/player/AVPlayer#
     * @private
     */
    __onSubtitleCallback(duration, text) {
      info(`__onSubtitleCallback: duration: ${duration}, text: ${text}`);

      this.dispatchEvent(PLAYER_EVENT.SUBTITLE_UPDATE, {
        duration,
        text,
      });

      console.log('__onSubtitleCallback');
      console.log(text);

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

    /**
     * The drm callback
     * @method __onDRMCallback
     * @memberof samsung-tizen/player/AVPlayer#
     * @private
     */
    __onDRMCallback(drmEvent, drmData) {
      info(`__onDRMCallback: ${drmEvent}, ${drmData}`);
    },

    /**
     * Called when the video finish.
     * @method __onFinished
     * @memberof samsung-tizen/player/AVPlayer#
     * @private
     */
    __onFinished() {
      // TODO
      this.clearSubtitles();
      this.__showSubtitleContainer(false);

      info('__onFinished');
      this.__stopPlayback();

      this.dispatchEvent(PLAYER_EVENT.FINISHED);
    },

    /**
     * AVPlayer's private callback when a player error occurred.
     *
     * @method __onError
     * @param  {Number} eventType - The event type.
     * @memberof samsung-tizen/player/AVPlayer#
     * @private
     */
    __onError(eventType) {
      let GENERIC_UNKNOWN = PlaybackErrorConstants.ERROR.GENERIC.UNKNOWN;

      this.__stopPlayback();

      logError(`onError: ${eventType}`);
      this.dispatchEvent(PLAYER_EVENT.ERROR, GENERIC_UNKNOWN);
    },

    /**
     * Stop the play.
     * @method __stopPlayback
     * @memberof samsung-tizen/player/AVPlayer#
     * @private
     */
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
     * Play the video item.
     * @method play
     * @param {Number} second - Play the video at the specified second
     * @returns {Boolean} true - if the play action was successful to allow the FSM to transition.
     * @memberof samsung-tizen/player/AVPlayer#
     * @public
     */
    play(second) {
      info(`play is called. second: ${second}`);

      if (this.__doLoadPromise) {
        info('Please wait while doLoad is running...');

        this.__secondToPlay = second;
        this.__isPendingPlay = true;

        return false;
      }

      if (this.__preparing) {
        info('Please wait while Tizen taking forever to prepare...');

        return false;
      }

      this.__withholdPlay = false;
      this.__withholdStop = false;
      this.__seekTime = 0;

      this.__show();

      this.__maybeLoad().then(util.bind(this.__doPlay, this, second)).done();

      return true;
    },

    /**
     * Utility function for play to determine if __doLoad needs to be called
     * before __doPlay.
     *
     * @method __maybeLoad
     * @returns {Promise} XDK Promise.
     * @memberof samsung-tizen/player/AVPlayer#
     * @private
     */
    __maybeLoad() {
      let drm = this.__drm;

      let connectedOrLoaded = this.__connected || this.__loaded;

      let drmNeedReload = drm === WIDEVINE || drm === PLAYREADY;

      let log = '';

      let vow;

      if (!connectedOrLoaded && drmNeedReload) {
        log += 'doLoad is needed before doPlay can be called.';
        vow = this.__doLoad(this.__url, this.__mediaOption);
      } else {
        log += 'doPlay can be called without a reload.';
        vow = promise.resolve();
      }

      info(log);

      return vow;
    },

    /**
     * Assists with playing the video.
     * @method __doPlay
     * @param {Number} second - Play the video at the specified second
     * @memberof samsung-tizen/player/AVPlayer#
     * @private
     */
    __doPlay(second) {
      info(`doPlay. second: ${second}`);

      this.__seekTime = second;

      let isSpeeding;
      let seekResult;

      if (!this.__connected) {
        // from idle state to ready state
        this.__withholdPlay = true;

        debug('doPlay. Not connected. prepareAsync may be needed.');

        if (!this.__preparing) {
          debug('doPlay: Not preparing. prepareAsync will be called.');

          this.__preparing = true;

          // there are two ways (prepare and prepareAsync), prepare will run synchronous and may block the process.
          // Replaced with prepareAsync, it will undergo the flow asynchronously(buffering start, buffering complete and the prepareAsync success callback)
          // If play in buffering start/complete, it will throw error. So the seeking and withhold play handling will be placed inside the prepareAsync callback.
          avplayProxy.prepareAsync(
            util.bind(this.__prepareSuccess, this),
            util.bind(this.__prepareFail, this)
          );
        } else {
          info('doPlay: Already preparing. Not calling again.');
        }
      }

      if (!util.isUndefined(second) && second >= 0) {
        // perform directly if paused, playing, speeding
        if (this.__isState(this.__PLAYER_STATE.PAUSED)) {
          if (this.__stopScreenSaverAndPlay() === avplayProxy.INVALID) {
            logError('Play failed.');

            return false;
          }

          seekResult = this.seek(second);

          return !util.isUndefined(seekResult) ? seekResult : true;
        } else if (this.__isState(this.__PLAYER_STATE.PLAYING)) {
          seekResult = this.seek(second);

          return !util.isUndefined(seekResult) ? seekResult : true;
        } else {
          this.__withholdPlay = true;
        }
      }

      if (this.__isState(this.__PLAYER_STATE.PLAYING)) {
        debug('player.__doPlay: Stream is playing. Done.');

        return true;
      }

      isSpeeding = this.__playbackSpeed > 1;

      // run only if it is not withhold and not speeding.
      // it will cause error when call play again during speeding
      if (!this.__withholdPlay && !isSpeeding) {
        debug('player.__doPlay: Stop screensaver and play...');

        if (this.__stopScreenSaverAndPlay() === avplayProxy.INVALID) {
          logError('Play failed.');

          return false;
        }

        debug('player.__doPlay: Stream is now playing. Done.');

        return true;
      }
    },

    /**
     * Get the AVPlayer's state.
     * @method __getState
     * @returns {String} AVPlayer state
     * @memberof samsung-tizen/player/AVPlayer#
     * @private
     */
    __getState() {
      return avplayProxy.getState().toLowerCase();
    },

    /**
     * Check the AVPlayer's state.
     * @method __isState
     * @param {String} state to check against AVPlayer state.
     * @returns {Boolean}
     * @memberof samsung-tizen/player/AVPlayer#
     * @private
     */
    __isState(state) {
      return this.__getState() === state;
    },

    /**
     * Stop the video playback.
     * @method stop
     * @returns {Boolean} true
     * @memberof samsung-tizen/player/AVPlayer#
     * @public
     */
    stop() {
      let stopResult = this.__stopPlayback();

      if (!util.isUndefined(stopResult)) {
        return stopResult;
      }

      // TODO: test return this.__isState(this.__PLAYER_STATE.IDLE);
      return true;
    },

    /**
     * Pause the video.
     * @method pause
     * @return {Boolean} true
     * @memberof samsung-tizen/player/AVPlayer#
     * @public
     */
    pause() {
      if (avplayProxy.pause() === avplayProxy.INVALID) {
        logError('Pause failed.');

        return false;
      }

      screenSaverOn();

      this.__withholdPlay = false;

      this.__updateCurrentTime();

      return this.__isState(this.__PLAYER_STATE.PAUSED);
    },

    /**
     * Resume playing the video.
     * @method resume
     * @public
     * @memberof samsung-tizen/player/AVPlayer#
     */
    resume() {
      if (this.__stopScreenSaverAndPlay() === avplayProxy.INVALID) {
        logError('Resume failed.');

        return false;
      }

      return this.__isState(this.__PLAYER_STATE.PLAYING);
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
     * Update the current time automatically.
     * @method __updateCurrentTime
     * @private
     * @memberof samsung-tizen/player/AVPlayer#
     */
    __updateCurrentTime() {
      let currentTime = avplayProxy.getCurrentTime();

      if (currentTime !== avplayProxy.INVALID) {
        this.__onCurrentPlayTime(currentTime);
      }
    },

    /**
     * Skip the playback forward/backward for certain seconds
     * @method skip
     * @param {Number} second number of seconds to skip (10 by default)
     * @public
     * @memberof samsung-tizen/player/AVPlayer#
     */
    skip(second) {
      let isSpeeding = this.__playbackSpeed > 1;

      let limit = this.getDuration() - 2;

      let current = this.getCurrentTime();

      let skipResult;

      // To skip a video, we need to set the playing speed back to 1.
      if (isSpeeding) {
        avplayProxy.setSpeed(1);
      }

      // XDK-2620 Sometimes, it will stuck when skipping but in fact it
      // skips properly adding try catch make it not blocking to the player.
      if (second < 0) {
        skipResult = avplayProxy.jumpBackward(-second * 1000);
      } else {
        second = current + second >= limit ? limit - current : second;
        skipResult = avplayProxy.jumpForward(second * 1000);
      }

      if (skipResult === avplayProxy.INVALID) {
        logError('Skip failed.');
      }

      // Roll back the speeding.
      if (isSpeeding) {
        avplayProxy.setSpeed(this.__playbackSpeed);
      }

      // Since it won't update the current time when paused or skipping,
      // so update the time directly.
      if (this.__isState(this.__PLAYER_STATE.PAUSED)) {
        // TODO: investigate -> || this.__isState(this.__PLAYER_STATE.SKIPPING)) {
        this.__updateCurrentTime();
      }

      return true;
    },

    /**
     * Speed up/down the media playback, media with drm aes-128 or type hls fail to speed
     * @method speed
     * @param {Number} speed the playback speed to set
     * @memberof samsung-tizen/player/AVPlayer#
     */
    speed(speed) {
      let speedResult;

      // Speeding for aes-128, HLS, and DASH disabled since it is not
      // possible due to device limitation
      if (this.__drm === AES_128 || this.__protocol === HLS || this.__protocol === DASH) {
        warn('Speed is not supported for this type.');

        return false;
      }

      // from -8x to 8x, it will give "UNKNOWN_ERROR_EVENT_FROM_PLAYER" when calling 16x.
      if (speed > 8) {
        speed = 8;
      }

      if (speed < -8) {
        speed = -8;
      }

      // We need to play the stream first or speeding will fail.
      if (this.__isState(this.__PLAYER_STATE.PAUSED)) {
        this.__stopScreenSaverAndPlay();
      }

      speedResult = avplayProxy.setSpeed(speed);

      if (speedResult === avplayProxy.INVALID) {
        logError('Speed failed.');

        return false;
      }

      this.__playbackSpeed = speed;

      // TODO: test return this.__isState(this.__PLAYER_STATE.PLAYING);
      return true;
    },

    /**
     * To get the playback speed.
     * @method getPlaybackSpeed
     * @returns {Integer} playback speed value.
     * @memberof samsung-tizen/player/AVPlayer#
     * @public
     */
    getPlaybackSpeed() {
      return this.__playbackSpeed;
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

      webapis?.avplay?.setDisplayMethod?.('PLAYER_DISPLAY_MODE_FULL_SCREEN');

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

    /**
     * Get the media bitrates
     * @method getBitrates
     * @return {interfaces/Player~MediaBitrates|null} current bitrate and available bitrates
     * @memberof samsung-tizen/player/AVPlayer#
     * @public
     */
    getBitrates() {
      // getBitrates DASH disabled since it is not possible due to current device limitation
      if (this.__protocol === DASH) {
        warn('getBitrates is not supported for this type.');

        return null;
      }

      let info = avplayProxy.getCurrentStreamInfo();

      let bitrateInfo = {
        currentBitrate: null,
        availableBitrates: avplayProxy.getStreamingProperty('AVAILABLE_BITRATE'),
      };

      let curInfo;

      // 0: video, 1: audio, 2:subtitle
      // On some tizen tv the string returned is incorrect and thus fail to parse
      // XDK-3177, some video may return the unterminated string
      // extract the number rather json parse the object
      // e.g {Codec:unknown,Width:1280,Height:720,Fps:23,Bit_rate:2090075}
      if (info.length && info[0].extra_info) {
        try {
          // extract the Bit_rate string (Bit_rate:2090075)
          curInfo = info[0].extra_info.match(/["']?Bit_rate["']?:["']?[0-9]+["']?/g);
          if (curInfo.length > 0) {
            // extract the number
            curInfo = curInfo[0].replace(/['"]?Bit_rate['"]?:['"]?([0-9]+)['"]?/g, '$1');
            bitrateInfo.currentBitrate = parseInt(curInfo, 10);
          }
        } catch (ex) {
          logError('Fail to get the current bitrate.');
        }
      }

      return bitrateInfo;
    },

    /**
     * Get the current playback time
     * @method getCurrentTime
     * @return {Number} the current playback time
     * @memberof samsung-tizen/player/AVPlayer#
     * @public
     */
    getCurrentTime() {
      return this.__currentTime;
    },

    /**
     * to get the total time of the video
     * @method getDuration
     * @return {number} the total time of the video
     * @memberof samsung-tizen/player/AVPlayer#
     * @public
     */
    getDuration() {
      let duration = avplayProxy.getDuration();

      if (duration !== avplayProxy.INVALID) {
        return duration / 1000;
      }

      return 0;
    },

    /**
     * set the id of the player
     * @method getId
     * @public
     * @param {String} id the path of the player
     * @memberof samsung-tizen/player/AVPlayer#
     */
    getId() {
      return this.__id;
    },

    /**
     * set the id of the player
     * @method setId
     * @param {String} id the path of the player
     * @memberof samsung-tizen/player/AVPlayer#
     * @public
     */
    setId(id) {
      this.__id = id;
    },

    // TODO
    // show the subtitlesContainer div
    showSubtitles() {
      console.log('showSubtitles p');
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

    /**
     * get the extension Manager
     * @method getExtensionManager
     * @returns {media/extensionManager} the player extension manager
     * @memberof samsung-tizen/player/AVPlayer#
     * @public
     */
    getExtensionManager() {
      return this._extensionManager;
    },

    /**
     * Indicate if the player is prepared and ready to load and play
     * @method isPrepared
     * @returns {Boolean} if player is prepared
     * @memberof samsung-tizen/player/AVPlayer#
     * @public
     */
    isPrepared() {
      return this.__prepared;
    },

    /**
     * Suspend handler for the player
     * @method doSuspend
     * @returns {Promise} XDK Promise.
     * @memberof samsung-tizen/player/AVPlayer#
     * @public
     */
    doSuspend() {
      this.pause();
      this.__hide();
      if (this.__prepared) {
        this.reset();
      }

      return promise.resolve();
    },
    /**
     * Restore handler for the player
     * @method doRestore
     * @param {Object} suspendOption the saved option in suspended state
     * @returns {Promise.<Boolean>} XDK Promise.
     * @memberof samsung-tizen/player/AVPlayer#
     * @public
     */
    doRestore({ url, option }) {
      const asyncFunction = async () => {
        const { __prepared, __loaded, __doLoadPromise } = this;

        if (!__prepared) {
          this.prepare(option);
        }

        // Extension manager would have been created if the player
        // is already in a loaded or loading state.
        if (!__loaded && !__doLoadPromise) {
          const extensionManager = this.getExtensionManager();

          await extensionManager?.prepare(this, option);

          console.log('[AVPlayer  doRestore]');
          console.log('option', option);
          this.load(url.replace('https', 'http'), option);
        }

        this.__show();

        return false;
      };

      return promise.toXDK(asyncFunction());
    },
  }
);

export default AVPlayer;

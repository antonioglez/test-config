/**
 * HTML5 player specifically for Youview.
 *
 * currently only for .ts & DASH.
 */
import logger from '@accedo/xdk-log';
import {
    klass,
    error,
    HTML5Player as HTML5BasePlayer,
    util,
    Environment,
    promise,
    MediaConstants,
    MediaExtensionConstants,
} from '@accedo/xdk-core';
import {
    applySupportedMediaFormat,
    applySupportedTransportProtocol,
} from '../helpers';

const {
    PROTOCOL: { PROGRESSIVE, DASH },
    DRM: { PLAYREADY },
} = MediaConstants;
const { DRM: DRM_EXTENSION } = MediaExtensionConstants.TYPE;
const { stringifyWithoutDom } = util;
const { IllegalArgument, UnsupportedOperation } = error;

const { info, log, logError } = logger({
    logTag: '[youview/player/HTML5Player]',
});

const HTML5Player = klass.create(
    HTML5BasePlayer,
    {
        SINGLE_PLAYER_ONLY: true,
        PRELOADABLE: false,
    },
    {
        /**
         * DRM technology being used.
         * @private
         */
        __drm: null,

        /**
         * The media URL.
         * @name __url
         * @type {String}
         * @private
         */
        __url: '',

        /**
         * extra parameter needed for the URL
         * @name __mediaOpts
         * @type {Object}
         * @private
         */
        __mediaOption: null,

        /**
         * store video data for youview reporting
         * @name __yvReportData
         * @type {Object}
         * @private
         */
        __yvReportData: null,

        /**
         * DRM URL for playready.
         * @private
         */
        __playReadyDrmURL: null,

        /**
         * Cache last custom data for playready.
         * @private
         */
        __lastPlayReadyDrmURL: null,

        /**
         * The media protocol.
         * @private
         */
        __protocol: null,

        /**
         * Flag to indicate if play(second) first time after load is called.
         * @private
         */
        __dashInitialSeek: false,

        /**
         * To store the DRM agent
         * @name __drmAgent
         * @type {Object}
         * @private
         */
        __drmAgent: null,

        /**
         * DRM loading promise.
         * @type {Promise}
         * @private
         */
        __doLoadPromise: null,

        /**
         * Flag to indicate if meta data has loaded
         * @type {Boolean}
         * @private
         */
        __metaDataLoaded: false,

        /**
         * Flag to indicate if meta data has loaded
         * @type {Boolean}
         * @private
         */
        __reportCreated: false,

        /**
         * Loads the specified media
         * @method load
         * @param {String} mediaURL the URL address of the media
         * @param {Object} [option] the options for loading this media
         * @param {string} [option.protocol] the media protocol
         * @param {string} [option.drm] DRM to be used
         * @public
         */
        async load(mediaURL, option = {}) {
            info(`load: ${mediaURL}, ${stringifyWithoutDom(option)}`);

            const drmOption =
                option?.protocol === DASH && !option?.drm
                    ? { ...option, drm: PLAYREADY }
                    : option;
            const { ok, drm, ...props } = this._loadCommon(mediaURL, drmOption);

            const onloadedMetadata = () => {
                log('onloadedMetadata');
                this._playerObject?.removeEventListener(
                    'loadedmetadata',
                    onloadedMetadata
                );
                this.__metaDataLoaded = true;
                if (!this.__reportCreated) {
                    try {
                        this._yvReporting().__report();
                    } catch (err) {
                        log(err);
                        logError(err);
                    }
                }
            };

            if (this.__metaDataLoaded) {
                log('__metaDataLoaded', this.__metaDataLoaded);
                this._playerObject?.removeEventListener(
                    'loadedmetadata',
                    onloadedMetadata
                );
            }
            this._playerObject?.addEventListener(
                'loadedmetadata',
                onloadedMetadata
            );

            if (!ok) {
                return false;
            }

            if (drm !== PLAYREADY) {
                this._loadNonPlayReady(props);

                return;
            }

            await this._loadPlayReady(props);
        },

        _loadCommon(mediaURL, option) {
            log('_loadCommon');
            // log('mediaURL:', mediaURL);
            // log('option: ', option);
            log('option.yvReportData: ', option.yvReportData);
            if (!this._prepared) {
                return { ok: false };
            }

            try {
                this._yvReporting().__stop();
            } catch (err) {
                logError(err);
            }

            this.__url = mediaURL;
            this.__mediaOption = option;
            this.__protocol = null;

            this.stop();
            this.__resetPlayerSource();
            this.__resetPlayreadyAttr();

            this._playerObject?.load();

            const {
                protocol,
                parentNode,
                drm = null,
                drmURL = option?.protectionData?.['com.microsoft.playready']
                    ?.serverURL || '',
                yvReportData = {},
            } = option;

            this.__dashInitialSeek = protocol === DASH;
            this.__protocol = protocol;
            this.__drm = drm;
            this.__yvReportData = yvReportData;

            if (parentNode) {
                this._preparePlayerObject(parentNode);
            }

            return {
                ok: true,
                drm,
                mediaURL,
                option,
                drmURL,
            };
        },

        dispatchCustomLoadEvent() {
            // NOTE - we have removed the default `__isPendingPlay` implementation in favor of the custom load event
            // the custom load event approach provides more control on choosing when to play

            // dispatch custom load event to signify media is in a ready state to start playback.
            info('load complete - dispatching custom load event');
            Environment.singleton().dispatchEvent('media:ready-to-play');
        },

        _loadNonPlayReady({ mediaURL, option }) {
            log('DRM !== PlayReady, doLoad can be done immediately.');

            this._doLoad(mediaURL, option);
            this.dispatchCustomLoadEvent();
        },

        async _loadPlayReady({ mediaURL, option, drmURL }) {
            log('DRM === PlayReady, load DRM Agent before doLoad.');

            this.__playReadyDrmURL = drmURL;

            await this.__loadDRM(mediaURL, option);
            await this._overrideLicenseUrl();

            this.dispatchCustomLoadEvent();
        },

        /**
         * Dedicated for player object to call load action.
         * @method _doLoad
         * @param {String} mediaURL the URL address of the media
         * @param {Object} [option] the options for loading this media
         * @param {string} [option.protocol] the media protocol
         * @param {string} [option.drm] DRM to be used
         * @protected
         */
        _doLoad(mediaURL, option) {
            log('doLoad');
            this.__setMediaURL(mediaURL, option);
        },

        /**
         * Set the url information
         * @method __setMediaUrl
         * @param {String} url the video url
         * @param {Object} option extra parameter needed for the media
         * @private
         */
        __setMediaURL(url, option) {
            log('__setMediaURL');

            // YouView CPS-1025 - YouView supports DASH only through HTTP
            let streamURL = applySupportedTransportProtocol(url);

            // non-dash with mime type won't play so we don't use video.type
            if (this.__protocol === DASH) {
                const type =
                    this.__getTypeValue(option) || 'application/dash+xml';

                this._playerObject?.setAttribute('type', type);
            } else {
                // YouView CPS-1025 - YouView does not support MP4, use a supported format instead (e.g. TS)
                streamURL = applySupportedMediaFormat(streamURL);

                this._playerObject?.removeAttribute('type');
            }

            this._playerObject?.setAttribute('src', streamURL);

            this._playerObject?.load();

            this._hide();
        },

        /**
         * To get the type value for setting to the video type attribute
         * @method __getTypeValue
         * @return {String} the stringify media option
         * @param {Object} [option] the options for loading this media
         * @param {string} [option.protocol] the media protocol
         * @param {string} [option.drm] DRM to be used
         * @private
         */
        __getTypeValue(option = {}) {
            const { protocol, drm } = option;

            log(`getting MIME for protocol: ${protocol}, drm: ${drm}`);

            let mimeType = this._getMimeType(option);

            log(`MIME Type: ${mimeType}`);

            return mimeType;
        },

        /**
         * perform the do Load which set the URL and possible attributes
         * with respect to the drm.
         * @method __loadDRM
         * @param {String} mediaURL the media URL
         * @param {Object} option the media options
         * @returns {Promise} Native Promise.
         * @private
         */
        __loadDRM(mediaURL, option) {
            info(`__loadDRM: ${mediaURL}, ${stringifyWithoutDom(option)}`);

            const { __doLoadPromise: loading } = this;

            if (loading) {
                log(`Already loading, return the same promise.`);

                return loading;
            }

            const loadAfresh = async () => {
                const { drm = this.__protocol === DASH && PLAYREADY } = option;
                const { drm: supportedDRM = [] } = this.getCapabilities();

                if (!supportedDRM.includes(drm)) {
                    throw new IllegalArgument(`DRM ${drm} is not supported.`);
                }
                const drmAgent = await this._getDrmAgent(drm);

                return drmAgent.prepare(option, this);
            };

            this.__doLoadPromise = loadAfresh()
                .catch((error) => logError(error))
                .finally(() => {
                    log('Clearing __doLoadPromise');
                    this.__doLoadPromise = null;
                });

            return this.__doLoadPromise;
        },

        /**
         * Async utility function that is responsible for checking the
         * provided DRM type and either return the existing DRM agent,
         * if the type matches. Or create a new DRM agent for the
         * calling function.
         *
         * @param {String} drm - DRM to be used.
         */
        async _getDrmAgent(drm) {
            const { __drmAgent: oldDrmAgent, __drmType: oldDrmType } = this;

            if (oldDrmAgent && oldDrmType === drm) {
                info('Reuse existing DRM agent.');

                return oldDrmAgent;
            }

            info('Create new DRM agent.');

            this.__drmType = drm || null;
            this.__drmAgent = null;

            const { _extensionManager } = this;

            if (!_extensionManager?.isExtensionSupported(DRM_EXTENSION)) {
                throw new UnsupportedOperation(
                    'DRM extension is not defined properly.'
                );
            }

            this._hide();

            const extension = await _extensionManager.getExtension(
                DRM_EXTENSION
            );
            const drmAgent = await extension.createDRMAgent(drm);

            this.__drmAgent = drmAgent;

            return drmAgent;
        },

        /**
         * Dedicated for player object to call stop action.
         * @method _doStop
         * @memberof device/player/HTML5Player#
         * @protected
         */
        _doStop() {
            log(`_doStop`);
            const parentStop = this._super.bind(this);

            parentStop();
            this._playerObject?.removeAttribute('src');
            this._playerObject?.load();
        },

        /**
         * To play the video and update the status of the remote control play/pause button.
         * @method play
         * @param {Number} [second] the playback start time
         * @returns {Boolean} Success of play state
         * @public
         */
        play(second) {
            log('play');

            if (this._isEnded()) {
                log(`Replay after playhead reach the end.`);
                this.reloadAndPlay(second);

                return true;
            }

            const parentPlay = this._super.bind(this);
            const playAction = this.__getPlayAction(second, parentPlay);

            return playAction();
        },

        /**
         * We have this function because if a video ended naturally, we
         * need to perform video.load() and then video.play(second). But
         * video.load is an asynchronous function, and so the whole
         * asynchronous business logic is wrapped here.
         */
        reloadAndPlay(second) {
            log('\n reloadAndPlay');
            const { __url, __mediaOption } = this;
            log('__mediaOption:', __mediaOption);

            const asyncFunction = async () => {
                await this.load(__url, __mediaOption);
                this.play(second);
            };

            asyncFunction();
        },

        __getPlayAction(second, parentPlay) {
            log('__getPlayAction');

            const { __protocol, __dashInitialSeek } = this;

            if (!(__protocol === DASH && __dashInitialSeek)) {
                log('DASH and initial seek is required.');

                const delayedSeek = () => {
                    this._playerObject?.removeEventListener(
                        'playing',
                        delayedSeek
                    );
                    // For DASH if the video is currently playing,
                    // need to wait for it to play first before seeking.
                    this.__dashInitialSeek = false;
                    this._seekTime = second;
                    this.__performDASHInitialSeek();
                };

                return () => {
                    this._playerObject?.addEventListener(
                        'playing',
                        delayedSeek
                    );

                    // play will always be speed 1x
                    if (this.getPlaybackSpeed() !== 1) {
                        this._setSpeed(1);
                    }

                    log('second', second);
                    log('this._seekTime', this._seekTime);
                    log('this.__dashInitialSeek', this.__dashInitialSeek);
                    this._doPlay();

                    return true;
                };
            }

            log('Non-DASH or no initial seek is required.');

            return () => {
                // playResult is to return boolean result for Media FSM
                const playResult = parentPlay(second);

                // Fail to seek time as Panasonic miss seeked event
                // when it is paused, we need to manually do play
                if (second && playResult && this._isPaused()) {
                    this._playerObject?.play();
                }

                return playResult;
            };
        },

        __drmSendLicense() {
            return promise.promise((resolve, reject) => {
                const { __drmAgent, _playerObject, __url, __mediaOption } =
                    this;

                const onloadMetadata = () => {
                    _playerObject?.removeEventListener(
                        'loadedmetadata',
                        onloadMetadata
                    );
                    resolve();
                };

                return __drmAgent
                    .sendLicense(__url, __mediaOption)
                    .then(() => {
                        _playerObject?.addEventListener(
                            'loadedmetadata',
                            onloadMetadata
                        );
                        _playerObject?.removeAttribute('src');

                        this.__setMediaURL(__url, __mediaOption);
                    })
                    .fail(reject);
            });
        },
        async _overrideLicenseUrl() {
            log('[_overrideLicenseUrl]');
            const { __playReadyDrmURL, onError } = this;

            this.__lastPlayReadyDrmURL = __playReadyDrmURL;

            // If the DRM agent exists and the media is already loaded
            // do a resume, otherwise load new media.

            log('[_overrideLicenseUrl] Send PlayReady license request.');

            try {
                return await this.__drmSendLicense();
            } catch (err) {
                return onError(err);
            }
        },

        /**
         * Performs the seek operation for DASH.
         * For DASH need to seek after start playing.
         * This should be done after the duration is ready, otherwise it won't work.
         * @method __performDASHInitialSeek
         * @private
         */
        __performDASHInitialSeek() {
            const { __protocol, _performInitialSeek } = this;

            if (__protocol !== DASH) {
                return;
            }

            setTimeout(_performInitialSeek.bind(this), 1000);
        },

        /**
         * Dedicated for player object to call play action.
         * @method _doPlay
         * @protected
         */
        _doPlay() {
            log('\n _doPlay');
            this._super();

            log('this.__yvReportData', this.__yvReportData);

            // if (this.__yvReportData.platformMetadata) {
            //   try {
            //     this._yvReporting().__report();
            //   } catch (err) {
            //     log(err);
            //     logError(err);
            //   }
            // }

            // const onloadedMetadata = () => {
            //   log('onloadedMetadata');
            //   this._playerObject?.removeEventListener('loadedmetadata', onloadedMetadata);
            //   this.__metaDataLoaded = true;
            //   try {
            //     this._yvReporting().__report();
            //   } catch (err) {
            //     log(err);
            //     logError(err);
            //   }
            // };

            // if (this.__metaDataLoaded) {
            //   log('__metaDataLoaded', this.__metaDataLoaded);
            //   this._playerObject?.removeEventListener('loadedmetadata', onloadedMetadata);
            // }
            // this._playerObject?.addEventListener('loadedmetadata', onloadedMetadata);
        },

        /**
         * Gets the player's capabilities
         * @method getCapabilities
         * @returns {interfaces/Player~PlayerCapabilities} the player's capabilities
         * @public
         */
        getCapabilities() {
            const protocol = [PROGRESSIVE, DASH];
            const drm = PLAYREADY;

            return {
                protocol,
                drm,
            };
        },

        /**
         * Resets the PlayReady attributes.
         * @method __resetPlayreadyAttr
         * @private
         */
        __resetPlayreadyAttr() {
            this.__lastPlayReadyDrmURL = null;
            this.__playReadyDrmURL = null;
            this.__drm = null;
        },

        __resetPlayerSource() {
            this._playerObject?.removeAttribute('src');
        },

        /**
         * Deinit the video player and remove the eventListeners.
         * @method reset
         * @public
         */
        reset() {
            log('reset()');
            log('this._prepared', this._prepared);
            if (!this._prepared) {
                return;
            }

            this.__reportCreated = false;

            this._playerObject?.reportmediaElement?.onVideoElementEvent({
                type: 'abort',
            });

            this.__resetPlayerSource();
            this.__resetPlayreadyAttr();

            this._playerObject?.removeEventListener('error', this.onError);
            this._playerObject?.load();

            this.__url = '';
            this.__mediaOption = null;
            this.__yvReportData = null;

            this.__protocol = null;
            this.__dashInitialSeek = false;

            this.__drmAgent = null;
            this.__doLoadPromise = null;

            this.__metaDataLoaded = false;

            this._super();
        },

        getParentNode() {
            return this._parentNode;
        },

        /**
         * Restore handler for the player
         * @method doRestore
         * @param {Object} [suspendOption] the saved option in suspended state
         * @returns {Promise.<Boolean>} XDK Promise. The wrapped Boolean value
         * indicate whether the player underneath should perform further
         * playback handling.
         * @public
         */
        doRestore(suspendOption = {}) {
            const asyncFunction = async () => {
                const { option, url } = suspendOption;
                const { _prepared, __doLoadPromise } = this;

                if (option && url) {
                    if (!_prepared) {
                        this.prepare(option);
                    }

                    if (!__doLoadPromise) {
                        const extensionManager = this.getExtensionManager();

                        await extensionManager?.prepare(this, option);
                    }

                    this.load(url, option);
                }

                this._show();

                return false;
            };

            return promise.toXDK(asyncFunction());
        },

        /**
         * Dedicated for youview to call youview reporting.
         * @method _yvReporting
         * @private
         */
        _yvReporting() {
            log('_yvReporting');

            const { _playerObject, __yvReportData } = this;

            log('__yvReportData', __yvReportData);

            const getVideoDetails = () => {
                return window.youview.private.reporting.getVideoDetails(
                    _playerObject
                );
            };

            const yvReport = (eventType) => {
                log('yvReport');
                const details = getVideoDetails();
                log('details', details);

                _playerObject.reportmediaElement.details = details;
                // _playerObject.yv_reporter.reportEvent(eventType, details);
                _playerObject.reportmediaElement.yv_reporter.reportEvent(
                    eventType,
                    details
                );
            };

            const sendResumeEvent = () => {
                log('resuming from the midroll, so sending the resume event');
                if (_playerObject.reportmediaElement.details) {
                    _playerObject.reportmediaElement.yv_reporter.reportEvent(
                        'play',
                        _playerObject.reportmediaElement.details
                    );
                    log('sent play event for resume');
                } else {
                    log(
                        'missing details so did not send play event for resume'
                    );
                }
            };

            const resetReporting = () => {
                _playerObject.reportmediaElement = null;
                delete _playerObject.reportmediaElement;
            };

            const getMediaElement = () => {
                const onVideoElementEvent = ({ type: eventType }) => {
                    if (
                        !_playerObject.reportmediaElement ||
                        !_playerObject.reportmediaElement.reportingActive
                    ) {
                        return;
                    }

                    const mediaEvents = [
                        'waiting',
                        'loadeddata',
                        'resize',
                        'seeking',
                        'abort',
                        'suspend',
                        'durationchange',
                        'ended',
                        'canplay',
                        'emptied',
                        'loadstart',
                        'loadedmetadata',
                        'error',
                        'canplaythrough',
                        'ratechange',
                        'seeked',
                        'pause',
                        'volumechange',
                        'stalled',
                        'timeupdate',
                        'play',
                        'playing',
                    ];

                    // log('eventType: ', eventType);

                    switch (eventType) {
                        case 'error':
                            logError(`MediaError:${_playerObject.error.code}`);
                        /* falls through */
                        case 'abort':
                        /* falls through */
                        case 'ended':
                            if (_playerObject.yv_reporter) {
                                yvReport('abort');
                                log(`${eventType}: Stop reporting...`);
                                _playerObject.yv_reporter.stop();
                                _playerObject.yv_reporter = null;
                                delete _playerObject.yv_reporter;
                            }

                            for (let i = 0; i < mediaEvents.length; i++) {
                                _playerObject.removeEventListener(
                                    mediaEvents[i],
                                    onVideoElementEvent,
                                    false
                                );
                            }

                            if (this._yvReporting) {
                                log('resetting');
                                resetReporting();
                            } else {
                                log('unable to reset yv reporting');
                            }

                            if (_playerObject.yv_reporter) {
                                window.removeEventListener(
                                    'beforeunload',
                                    _playerObject.yv_reporter.beforeUnload,
                                    false
                                );
                            }
                            break;
                        default:
                            // if (_playerObject.yv_reporter) {
                            //   yvReport(eventType);
                            // }
                            break;
                    }
                };

                const mediaElement = {
                    attributes: _playerObject.attributes,
                    assetId: __yvReportData.assetId,
                    reportingActive: true,
                    onVideoElementEvent,
                    addEventListener: (eventType, evenHandler, useCapture) => {
                        _playerObject.addEventListener(
                            eventType,
                            onVideoElementEvent,
                            useCapture
                        );
                    },
                    removeEventListener: (
                        eventType,
                        evenHandler,
                        useCapture
                    ) => {
                        _playerObject.removeEventListener(
                            eventType,
                            onVideoElementEvent,
                            useCapture
                        );
                    },
                };

                if (_playerObject.reportmediaElement) {
                    if (
                        _playerObject.reportmediaElement.assetId ===
                        __yvReportData.assetId
                    ) {
                        sendResumeEvent();
                        _playerObject.reportmediaElement.reportingActive = true;

                        return null;
                    } else {
                        _playerObject.reportmediaElement.reportingActive = true;
                        log(
                            'playing the different main asset, so it is not a resume'
                        );
                    }
                }

                return mediaElement;
            };

            const initYVReporting = (videoElement) => {
                _playerObject.yv_reporter = videoElement.yv_reporter;
                _playerObject.reportmediaElement = videoElement;
            };

            const extractTextInsideTag = (tag, element) => {
                const regex = new RegExp(`<${tag}>(.+)</${tag}>`);
                const tagMatch = element.match(regex);

                return tagMatch && tagMatch[1] ? tagMatch[1] : null;
            };

            const __report = () => {
                log('_yvReporting.__report');

                if (!window.youview) {
                    log('No youview object exists on window');

                    return;
                }

                log('__yvReportData:', __yvReportData);
                log('__dashInitialSeek', this.__dashInitialSeek);
                const platformMetadata = __yvReportData.platformMetadata;

                if (!platformMetadata) {
                    log(
                        `No video object or platformMetadata given, Youview Reporting won't be started!`
                    );

                    return;
                }

                const appContext = __yvReportData.appContext;
                const crid = extractTextInsideTag('CRID', platformMetadata);
                const imi = extractTextInsideTag('IMI', platformMetadata);

                try {
                    log('Starting report');
                    log('CRID: ', crid);

                    const videoElement = getMediaElement();

                    if (!videoElement) {
                        log(
                            'instructed not to register to the native yv reporting....'
                        );

                        return;
                    }

                    const reportAttributes =
                        window.youview.reporting.ReportFactory.createMediaAttributesForOnDemand(
                            appContext,
                            window.youview.reporting.MediaTypeValues
                                .OD_CATCH_UP,
                            crid,
                            imi
                        );

                    window.youview.reporting.ReportFactory.createReport(
                        videoElement,
                        reportAttributes
                    );

                    initYVReporting(videoElement);

                    log('Completed report');
                    this.__reportCreated = true;
                    // _playerObject.reportmediaElement.reportingActive = false;
                } catch (err) {
                    logError(err);
                }
            };

            const __stop = () => {
                log('_yvReporting.__stop');

                if (_playerObject.reportmediaElement) {
                    if (!__yvReportData.isAd) {
                        log('it is the main asset');
                    } else {
                        log('it is the advert');
                        if (_playerObject.reportmediaElement.reportingActive) {
                            log(
                                'switched from main asset to advert, so sending the pause event'
                            );
                            yvReport('pause');
                        } else {
                            log('advert to advert so will not take action');
                        }
                    }
                    _playerObject.reportmediaElement.reportingActive = false;
                } else {
                    log('This is the play from start, fresh reporting');
                }
            };

            return { __report, __stop };
        },
    }
);

export default HTML5Player;

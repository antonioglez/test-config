/* eslint-disable prefer-destructuring */
/* eslint-disable no-else-return */
/* eslint-disable no-plusplus */
/* eslint-disable arrow-body-style */
/* eslint-disable consistent-return */
/* eslint-disable no-underscore-dangle */
/* eslint-disable no-unused-vars */
/**
 * HTML5 player specifically for Youview.
 *
 * currently only for .ts & DASH.
 */
import HTML5Player from '@accedo/xdk-device-youview-html5-contrib/esm/player/HTML5Player';
import logger from '@accedo/xdk-log';
import { klass, HTML5Player as HTML5BasePlayer, util, MediaConstants } from '@accedo/xdk-core';

const {
  PROTOCOL: { PROGRESSIVE, DASH },
  DRM: { PLAYREADY },
} = MediaConstants;
const { stringifyWithoutDom } = util;

const { info, debug, logError } = logger({
  logTag: '[youview/player/HTML5Player]',
});

const ExtendedHTML5Player = klass.create(
  HTML5Player,
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
        option?.protocol === DASH && !option?.drm ? { ...option, drm: PLAYREADY } : option;
      const { ok, drm, ...props } = this._loadCommon(mediaURL, drmOption);

      const onloadedMetadata = () => {
        this._playerObject?.removeEventListener('loadedmetadata', onloadedMetadata);
        this.__metaDataLoaded = true;
        if (!this.__reportCreated) {
          try {
            this._yvReporting().__report();
          } catch (err) {
            logError(err);
          }
        }
      };

      if (this.__metaDataLoaded) {
        this._playerObject?.removeEventListener('loadedmetadata', onloadedMetadata);
      }
      this._playerObject?.addEventListener('loadedmetadata', onloadedMetadata);

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
        drmURL = option?.protectionData?.['com.microsoft.playready']?.serverURL || '',
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

    /**
     * Dedicated for player object to call play action.
     * @method _doPlay
     * @protected
     */
    _doPlay() {
      // this._super();
      debug(`_doPlay`);
      this._show();
      this._playerObject?.play();
    },

    /**
     * Deinit the video player and remove the eventListeners.
     * @method reset
     * @public
     */
    reset() {
      debug('reset()');
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

    /**
     * Dedicated for youview to call youview reporting.
     * @method _yvReporting
     * @private
     */
    _yvReporting() {
      const { _playerObject, __yvReportData } = this;

      const getVideoDetails = () => {
        return window.youview.private.reporting.getVideoDetails(_playerObject);
      };

      const yvReport = (eventType) => {
        const details = getVideoDetails();

        _playerObject.reportmediaElement.details = details;
        _playerObject.yv_reporter.reportEvent(eventType, details);
      };

      const sendResumeEvent = () => {
        debug('resuming from the midroll, so sending the resume event');
        if (_playerObject.reportmediaElement.details) {
          _playerObject.reportmediaElement.yv_reporter.reportEvent(
            'play',
            _playerObject.reportmediaElement.details
          );
          debug('sent play event for resume');
        } else {
          debug('missing details so did not send play event for resume');
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

          switch (eventType) {
            case 'error':
              logError(`MediaError:${_playerObject.error.code}`);
            /* falls through */
            case 'abort':
            /* falls through */
            case 'ended':
              if (_playerObject.yv_reporter) {
                yvReport('abort');
                debug(`${eventType}: Stop reporting...`);
                _playerObject.yv_reporter.stop();
                _playerObject.yv_reporter = null;
                delete _playerObject.yv_reporter;
              }

              for (let i = 0; i < mediaEvents.length; i++) {
                _playerObject.removeEventListener(mediaEvents[i], onVideoElementEvent, false);
              }

              if (this._yvReporting) {
                debug('resetting');
                resetReporting();
              } else {
                debug('unable to reset yv reporting');
              }

              if (_playerObject.yv_reporter) {
                window.removeEventListener(
                  'beforeunload',
                  _playerObject.yv_reporter.beforeUnload,
                  false
                );
              }
              break;
            case 'timeupdate':
              break;
            default:
              if (_playerObject.yv_reporter) {
                yvReport(eventType);
              }
              break;
          }
        };

        const mediaElement = {
          attributes: _playerObject.attributes,
          assetId: __yvReportData.assetId,
          reportingActive: true,
          onVideoElementEvent,
          addEventListener: (eventType, evenHandler, useCapture) => {
            _playerObject.addEventListener(eventType, onVideoElementEvent, useCapture);
          },
          removeEventListener: (eventType, evenHandler, useCapture) => {
            _playerObject.removeEventListener(eventType, onVideoElementEvent, useCapture);
          },
        };

        if (_playerObject.reportmediaElement) {
          if (_playerObject.reportmediaElement.assetId === __yvReportData.assetId) {
            sendResumeEvent();
            _playerObject.reportmediaElement.reportingActive = true;

            return null;
          } else {
            _playerObject.reportmediaElement.reportingActive = true;
            debug('playing the different main asset, so it is not a resume');
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
        if (!window.youview) {
          debug('No youview object exists on window');

          return;
        }

        const platformMetadata = __yvReportData.platformMetadata;

        if (!platformMetadata) {
          debug(`No video object or platformMetadata given, Youview Reporting won't be started!`);

          return;
        }

        const appContext = __yvReportData.appContext;
        const crid = extractTextInsideTag('CRID', platformMetadata);
        const imi = extractTextInsideTag('IMI', platformMetadata);

        try {
          debug('Starting report');

          const videoElement = getMediaElement();

          if (!videoElement) {
            debug('instructed not to register to the native yv reporting....');

            return;
          }

          const reportAttributes = window.youview.reporting.ReportFactory.createMediaAttributesForOnDemand(
            appContext,
            window.youview.reporting.MediaTypeValues.OD_CATCH_UP,
            crid,
            imi
          );

          window.youview.reporting.ReportFactory.createReport(videoElement, reportAttributes);

          initYVReporting(videoElement);

          this.__reportCreated = true;
          debug('Completed report');
        } catch (err) {
          logError(err);
        }
      };

      const __stop = () => {
        if (_playerObject.reportmediaElement) {
          if (!__yvReportData.isAd) {
            debug('it is the main asset');
          } else {
            debug('it is the advert');
            if (_playerObject.reportmediaElement.reportingActive) {
              debug('switched from main asset to advert, so sending the pause event');
              yvReport('pause');
            } else {
              debug('advert to advert so will not take action');
            }
          }
          _playerObject.reportmediaElement.reportingActive = false;
        } else {
          debug('This is the play from start, fresh reporting');
        }
      };

      return { __report, __stop };
    },
  }
);

export default ExtendedHTML5Player;

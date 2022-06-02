/* eslint-disable camelcase */
/* eslint-disable no-underscore-dangle */
/**
 * Subtitle strategy for Tizen's AVPlayer. This strategy instance is
 * initialised by {@link media/Subtitle} and has the full knowledge of the
 * associated XDK player object and the actual Tizen player object underneath.
 *
 * @class samsung-tizen/player/extension/AVPlayerSubtitles
 * @implements interfaces/SubtitleStrategy
 */

/**
 * Reference Documentation extracted from:
 * https://developer.samsung.com/smarttv/develop/api-references/samsung-product-api-references/avplay-api.html
 *
 *
 * [AVPlayManager]
 *
 * void setSelectTrack(AVPlayStreamType trackType, long trackIndex) - https://developer.samsung.com/smarttv/develop/api-references/samsung-product-api-references/avplay-api.html#AVPlay-AVPlayManager-setSelectTrack
 *
 * Constraints:
 *  1 Can be called in the following states: "READY" (for Smooth Streaming only), "PLAYING", "PAUSED" (for TEXT tracks only)
 *  2 If buffering is not complete, calling this method for an AUDIO track returns an error.
 *  3 The trackType "TEXT" is not supported for DASH streaming.
 *
 * AVPlayCurrentStreamInfo getCurrentStreamInfo()
 *
 * AVPlayStreamInfo[] getTotalTrackInfo()
 *
 *
 * [AVPlayStreamType]
 * enum AVPlayStreamType {
 *   "VIDEO",
 *   "AUDIO",
 *   "TEXT"
 * };
 *
 *
 * [AVPlayStreamInfo]
 * dictionary AVPlayStreamInfo {
 *   unsigned long index;
 *   AVPlayStreamType type;
 *   DOMString extra_info;
 * };
 * extra_info for subtitle tracks: "{"track_num":"%d","track_lang":"%s","subtitle_type":"%d","fourCC":"%s"}"
 * sample: "{"track_num":"0","track_lang":"eng","subtitle_type":"-1","fourCC":"TTML"}"
 *
 *
 * [AVPlayPlaybackCallback]
 *
 * onsubtitlechange event: https://developer.samsung.com/smarttv/develop/api-references/samsung-product-api-references/avplay-api.html#AVPlay-AVPlayPlaybackCallback-onsubtitlechange
 *
 * void onsubtitlechange(unsigned long duration, DOMString subtitles, unsigned long type, AVPlaySubtitleAttribute attributes);
 * Parameters:
 *  - duration: unsigned long
 *  - subtitles: DOMString
 *  - type: unsigned long
 *  - attriCount: unsigned long
 *  - attributes: AVPlaySubtitleAttribute "attr_type": "AttributeType:value"; "start_pos": start position as long; "stop_pos": stop position as long
 *  - Exceptions:
 *
 * WebAPIException
 *  - with error type NotSupportedError, if this feature is not supported.
 *
 *  - with error type UnknownError, for any other error.
 */

import logger from '@accedo/xdk-log';
import { klass, error, ISubtitleStrategy, util } from '@accedo/xdk-core';
import * as avplayProxy from '@accedo/xdk-device-samsung-tizen/esm/avplayProxy';
import {
  canGetAllTracks,
  canSetTrack,
  cannot,
} from '@accedo/xdk-device-samsung-tizen/esm/player/extension/AVPlayerUtils';

const logTag = `[samsung-tizen/player/extension/AVPlayerSubtitles]`;
const { logError, debug } = logger({ logTag });
const { IllegalArgument, IllegalState } = error;

const SUBTITLE_TYPE = 'TEXT';
const LANGCODE = 'LANGCODE';

const SubtitleStrategy = klass.create(
  [ISubtitleStrategy],
  {
    SUBTITLE_TYPE,
    LANGCODE,
  },
  {
    /**
     * A local reference to the XDK player object.
     *
     * @name __player
     * @memberof samsung-tizen/player/extension/AVPlayerSubtitles#
     * @type {Object}
     * @private
     */
    __player: null,

    /**
     * A local reference to the Tizen player object.
     *
     * @name __playerObject
     * @memberof samsung-tizen/player/extension/AVPlayerSubtitles#
     * @type {Object}
     * @private
     */
    __playerObject: null,

    /**
     * List of known subtitles.
     *
     * @name __subtitleArr
     * @memberof samsung-tizen/player/extension/AVPlayerSubtitles#
     * @type {SubtitleTracks}
     * @private
     */
    __subtitleArr: [],
    __outbandSubtitles: undefined,

    /**
     * Prepare the Subtitle Strategy instance, which has the full
     * knowledge of the player object it is associated.
     *
     * @method prepare
     * @param {interfaces/Player} player - Reference to the XDK player
     * instance that implement the interface {@link interfaces/Player}.
     *
     * @returns {undefined} Always returned undefined, even if the input
     * parameter cause a failure in the preparation.
     * @memberof samsung-tizen/player/extension/AVPlayerSubtitles#
     * @public
     * @see {@link media/Subtitle}
     * @see {@link media/ExtensionManager}
     */
    prepare(player, subtitles = null) {
      this.__outbandSubtitles = !!subtitles;

      if (!player) {
        logError(
          'Fail to prepare the Tizen AVPlayer Subtitle Strategy without the XDK player object.'
        );

        return;
      }

      this.__player = player;
      this.__playerObject = player._getPlayerObject();

      if (!this.__playerObject) {
        logError(
          'Fail to prepare the Tizen AVPlayer Subtitle Strategy without the AVPlayer object.'
        );

        return;
      }

      debug('AVPlayer Subtitle Strategy prepared.');
    },

    /**
     * An array of {@link SubtitleObject}.
     *
     * @global
     * @typedef {Array.<SubtitleObject>} SubtitleTracks
     */

    /**
     * Returns an array of all known subtitle tracks. Video, audio or other
     * tracks will not appear in the array.
     *
     * As defined by Samsung's documentation, this function can be called
     * when the player is ready or during playing. If the player is at
     * other state, the function will simply return a rejected promise.
     *
     * @method getSubtitles
     * @returns {Promise.<SubtitleTracks>} Native Promise, wrapping an
     * array of {@link SubtitleObject}.
     * @memberof samsung-tizen/player/extension/AVPlayerSubtitles#
     * @public
     */
    async getSubtitles() {
      if (!this.__outbandSubtitles && !canGetAllTracks(this.__player)) {
        throw new IllegalState(cannot('get subtitle tracks'));
      }
      const subtitleTracks = avplayProxy.getTotalTrackInfo().reduce((acc, info, index) => {
        const { type, extra_info } = info;

        if (type === SUBTITLE_TYPE) {
          let extraInfoJS;

          try {
            extraInfoJS = JSON.parse(extra_info);
          } catch (e) {
            logError('extra_info parse error');
          }

          const { track_lang: language, fourCC } = extraInfoJS;

          acc.push({
            id: index, // This is needed like this and not with the info.index
            language,
            label: language, // There's no other language related info in the extra_info Object
            mimetype: fourCC,
            extra_info, // We add the extra_info just in case
          });
        }

        return acc;
      }, []);

      this.__subtitleArr = subtitleTracks;

      return subtitleTracks;
    },

    /**
     * Set the current subtitle track to the track identified by the
     * track `id`. If succeeded, the new ID can be retrieved by calling the
     * function {@link getCurrentSubtitle}.
     *
     * As defined by Samsung's documentation, this function can only be
     * called when the player is playing or currently paused. In other
     * state, this function will simply returned a rejected promise.
     *
     * @method showSubtitle
     * @param {Integer} index - Index of the subtitle track to be set active. The
     * id of all available subtitle track(s) can be found by calling the
     * function {@link getSubtitles}.
     * @returns {Promise} Native Promise.
     * @memberof samsung-tizen/player/extension/AVPlayerSubtitles#
     * @public
     * @see {@link getCurrentSubtitle}
     */
    async showSubtitle(index) {
      console.log('showSubtitle Internal');
      if (!canSetTrack(this.__player)) {
        throw new IllegalState(cannot('set subtitle tracks'));
      }

      const trackExists = this.__subtitleArr.some(({ id: trackId }) => trackId === index);

      if (!trackExists || util.isUndefined(index)) {
        throw new IllegalArgument(`Track ${index} cannot be found.`);
      }
      avplayProxy.setSelectTrack(SUBTITLE_TYPE, index);
      avplayProxy.setSilentSubtitle(false);

      return true;
    },

    /**
     * Hide the subtitles, removing the onsubtitlechange event.
     *
     * @method hideSubtitle
     * @returns {Promise} Native Promise.
     * rejected one otherwise.
     * @memberof samsung-tizen/player/extension/AVPlayerSubtitles#
     * @public
     */
    async hideSubtitle() {
      avplayProxy.setSilentSubtitle(true);
    },

    deinit() {
      this.__player = null;
      this.__playerObject = null;
      this.__subtitleArr = [];
    },
  }
);

export default SubtitleStrategy;

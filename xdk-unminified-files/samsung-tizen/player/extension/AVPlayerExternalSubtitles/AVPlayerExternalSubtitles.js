/* eslint no-underscore-dangle: ["error", { "allowAfterThis": true }] */

/**
 * Abstract Class that can be used to hande any external subtitle that needs to be downloaded.
 * The implementation will need to override the _parseSubtitles method.
 *
 * Do not support regions for now. YOUR IMPLEMENTED PARSER SHOULD GROUP THE SUBTITLES
 *
 * Requires fetch or a polyfill
 *
 * By default this extension will fire SUBTITLE_UPDATE events that needs to be handled to render the subtitles
 *
 * Example
 * ```javascript
  import xdk, {environment, PlayerConstants, getSubtitleRenderer} from '@accedo/xdk-core';
  import styles from '../style.module.css';
  // ...
  xdk.environment.addEventListener(SUBTITLE_UPDATE, getSubtitleRenderer({
    className:styles["subtitle"]})
  );
 * ```
 *
 * @class xdk-players-contrib/extensions/subtitles/AbstractExternal
 * @implements {SubtitleStrategy}
 */

/**
 * Subtitle Tracks definition. Used on the subtitle methods and the initialization of the player for external subtitles.
 * Based on Text Track from HTML5 https://developer.mozilla.org/en-US/docs/Web/API/TextTrack
 * @typedef {Object} SubtitleTrack
 * @property {Number} startTime - Start time of the text track.
 * @property {Number} startTiendTime - End time of the text track.
 * @property {String} text - Text to render
 * @property {String} [region] - Region to render the subtitle
 * @memberof xdk-players-contrib/extensions/subtitles/AbstractExternal#
 */

/**
 * @typedef {Object} GroupedTracks
 * @property {SubtitleTrack[]} second -  i.e groupedTracks[0]. Subtitle tracks available on that second
 * @memberof xdk-players-contrib/extensions/subtitles/AbstractExternal#
 */
import { klass, ISubtitleStrategy, Environment, PlayerConstants, error } from '@accedo/xdk-core';
import logger from '@accedo/xdk-log';
import axios from 'axios';

import styles from './style.module.scss';

import getSubtitleRenderer from './subtitleRenderer';

const sEnv = Environment.singleton();
// number of seconds to look backward
const OFFSET = 1;

const {
  EVENT: { TIME_UPDATE, SUBTITLE_UPDATE },
} = PlayerConstants;

const { info } = logger({
  logTag: `[@accedo/xdk-players-contrib/extensions/subtitles/vtt.js]`,
});

const AbstractExternalSubtitleExtension = klass.create(
  [ISubtitleStrategy],
  {},
  {
    __player: null,
    __subtitlesMap: null,
    __currentSubtitle: null,
    __currentTrack: null,
    __subtitleUpdateListener: null,
    __playerState: undefined,
    /**
     * Callback methods that is triggered every time the player sends a time update
     * Is used to find an active text track and send it to the Subtitle renderer
     *
     * @protected
     * @memberof xdk-players-contrib/extensions/subtitles/AbstractExternal#
     * @param {Integer} currentTime Current time in seconds
     */
    __onTimeUpdate(currentTime) {
      this._previousTime = currentTime;

      if (currentTime < this._previousTime) {
        this.__currentTrack = null;

        return sEnv.dispatchEvent(SUBTITLE_UPDATE, { text: '' });
      }

      if (this.__currentTrack && this?.__currentTrack?.endTime >= currentTime) {
        // eslint-disable-next-line consistent-return
        return;
      }

      if (this.__currentTrack) {
        this.__currentTrack = null;
        sEnv.dispatchEvent(SUBTITLE_UPDATE, { duration: 0, text: '' });
      }

      const track = this._findTrackByStartingTime(currentTime);

      if (track === null) {
        // eslint-disable-next-line consistent-return
        return;
      }
      this.__currentTrack = track;

      const duration = track.endTime - track.startTime;

      sEnv.dispatchEvent(SUBTITLE_UPDATE, {
        duration,
        text: track.text,
        track,
      });
    },

    /**
     * Checks if the passed subtitles on the xdk.media.load method are correct
     *
     * @protected
     * @memberof xdk-players-contrib/extensions/subtitles/AbstractExternal#
     * @param {Object[]} subtitles Array object
     * @returns {Object[]} Array of sanitized subtitles
     */
    _sanitizeSubtitles(subtitles = []) {
      return (
        subtitles
          // eslint-disable-next-line array-callback-return
          .map(({ id, ...rest }) => {
            const { url, language, label, mimetype } = rest;

            info(
              `External Subtitle info id:${id}, url:${url}, language:${language}, label:${label}, mime:${mimetype}`
            );

            if (id && url && mimetype) {
              return { id, ...rest };
            }
          })
          .filter((subtitle) => subtitle)
      );
    },

    /**
     * Looks if there are available tracks for a given seconds as a starting time
     *
     * @protected
     * @memberof xdk-players-contrib/extensions/subtitles/AbstractExternal#
     * @param {Integer} seconds
     * @param {Integer} seconds
     * @returns {SubtitleTrack} Subtitle track
     */
    _findTrackByStartingTime(seconds) {
      const second = Math.floor(seconds);
      const tracksInRange = [];

      // eslint-disable-next-line no-plusplus
      for (let counter = OFFSET; counter > 0; counter--) {
        const tracks = this.__currentSubtitle?.tracks?.[second - counter];

        if (tracks) {
          tracksInRange.push(...tracks);
        }
      }

      return (
        tracksInRange.find(({ startTime, endTime }) => {
          info(startTime, endTime, seconds);

          return seconds >= startTime && seconds <= endTime;
        }) || null
      );
    },

    /**
     * Downloads the subtitle for the given URL and returns the content as a
     * Requires fetch or a polyfill
     *
     * @protected
     * @memberof xdk-players-contrib/extensions/subtitles/AbstractExternal#
     * @param {String} url URL where the subtitle is hosted
     * @returns {String} Downloaded subtitle as a string
     */
    async _downloadSubtitle(url) {
      return axios.get(url).then((response) => response.data);
    },

    /**
     * Optimization for the onTimeUpdate callback.
     * Groups the subtitles by their second, to avoid to iterate over
     * all the available tracks.
     *
     * @protected
     * @memberof xdk-players-contrib/extensions/subtitles/AbstractExternal#
     * @param {SubtitleTrack[]} Subtitle tracks
     * @returns {GroupedTracks} Grouped tracks
     */
    _groupSubtitleTracks(subtitleTracks) {
      const groupedTracks = { tracks: {} };

      subtitleTracks.forEach((cue) => {
        const second = Math.floor(cue.startTime);

        if (!groupedTracks.tracks[second]) {
          groupedTracks.tracks[second] = [];
        }

        groupedTracks.tracks[second].push(cue);
      });

      return groupedTracks;
    },

    /**
     * Abstract method. Get the subtitles in a text format and parse it
     * to the SubtitleTrack array that this extension is able to handle
     *
     * @protected
     * @memberof xdk-players-contrib/extensions/subtitles/AbstractExternal#
     * @param {String} text Text contaaining the subtitles to parse.
     * @returns {SubtitleTrack[]} Array of subtitle tracks
     */
    // eslint-disable-next-line no-unused-vars
    async _parseSubtitles(text) {
      const { WebVTT, VTTCue } = await import('vtt.js');

      window.VTTCue = VTTCue;
      const parser = new WebVTT.Parser(window, WebVTT.StringDecoder());

      const parsedSubtitle = [];

      parser.oncue = (cue) => {
        parsedSubtitle.push(cue);
      };
      await parser.parse(text);

      return parsedSubtitle;
    },

    /**
     * @memberof xdk-players-contrib/extensions/subtitles/AbstractExternal#
     */
    init() {
      if (!document.getElementById('subtitle')) {
        sEnv.addEventListener(
          SUBTITLE_UPDATE,
          getSubtitleRenderer({
            // eslint-disable-next-line dot-notation
            className: styles['subtitle'],
          })
        );
      }
      this.__onTimeUpdateRef = this.__onTimeUpdate.bind(this);
    },

    /** @memberof xdk-players-contrib/extensions/subtitles/AbstractExternal# */
    prepare(player, subtitles) {
      if (!player) {
        throw new error.IllegalState('No Player found');
      }
      this.__player = player;

      if (subtitles) {
        this.__subtitlesMap = {};

        const sanitizedSubtitles = this._sanitizeSubtitles(subtitles);

        if (!(sanitizedSubtitles.length > 0)) {
          throw new error.IllegalState(`No valid external subtitles ${JSON.stringify(subtitles)}`);
        }

        try {
          sanitizedSubtitles.forEach((subtitle) => {
            this.__subtitlesMap[subtitle.id] = subtitle;
          });
        } catch (e) {
          throw new error.Generic('error', e);
        }

        return sanitizedSubtitles;
      }
    },

    /** @memberof xdk-players-contrib/extensions/subtitles/AbstractExternal# */
    async showSubtitle(id) {
      const subtitle = this.__subtitlesMap[id];
      let parsedSubtitle;
      let downloadedSubtitle;
      let { url, parsedSubtitle: subtitleWithGroupedTracks } = subtitle;

      if (!url) {
        throw new error.Generic(`No subtitle found with id:${id}`);
      }

      if (!subtitleWithGroupedTracks) {
        try {
          downloadedSubtitle = await this._downloadSubtitle(url);
        } catch (err) {
          throw new error.Generic(`Error fetching subtitle with id:${id} and url:${url}`, err);
        }

        try {
          parsedSubtitle = await this._parseSubtitles(downloadedSubtitle);
          subtitleWithGroupedTracks = this._groupSubtitleTracks(parsedSubtitle);
          subtitle.parsedSubtitle = subtitleWithGroupedTracks;
          this.__subtitlesMap[id] = subtitle;
        } catch (err) {
          throw new error.Generic(
            `Error on parsing vtt subtitles with id:${id} and url:${url}`,
            err
          );
        }

        if (!subtitleWithGroupedTracks) {
          throw new error.Generic(`Empty subtitle response with id:${id} and url:${url}`);
        }
      }

      this.__currentSubtitle = subtitleWithGroupedTracks;

      this.__player.addEventListener(TIME_UPDATE, this.__onTimeUpdateRef);

      return subtitleWithGroupedTracks;
    },

    /** @memberof xdk-players-contrib/extensions/subtitles/AbstractExternal# */
    async hideSubtitle() {
      this.__currentSubtitle = null;
      this.__currentTrack = null;
      this.__player.removeEventListener(TIME_UPDATE, this.__onTimeUpdateRef);
      sEnv.dispatchEvent(SUBTITLE_UPDATE, { text: '' });
    },

    /** @memberof xdk-players-contrib/extensions/subtitles/AbstractExternal# */
    getCurrentSubtitle() {
      return this.__currentSubtitle;
    },

    /** @memberof xdk-players-contrib/extensions/subtitles/AbstractExternal# */
    async getSubtitles() {
      return Array.from(Object.values(this.__subtitlesMap));
    },

    /** @memberof xdk-players-contrib/extensions/subtitles/AbstractExternal# */
    deinit() {
      if (this.__currentSubtitle) this.hideSubtitle();

      this.__player = null;
      this.__currentSubtitle = null;
      this.__currentTrack = null;
    },
  }
);

export default AbstractExternalSubtitleExtension;

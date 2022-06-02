// const body = document.getElementsByTagName('body')?.[0];

/**
 * Generator function. Returns a SUBTITLE_UPDATE event handler that renders the subtitles.
 * Valid for any subtitle strategy that requires a reneder, like Samsung tizen or the vtt.js one.
 *
 * @param {Object} parentNode Parent node where to append the subtitles container. Defaults to body
 * @param {String} className Class name for the DOM element. defaults to subtitle
 * @returns {Function} Function to be used on a SUBTITLE_UPDATE callback
 */
const getSubtitleRenderer = ({ className = 'subtitle' }) => {
  // if (!document.getElementById('subtitle')) {

  import('./subtitleRendererStyles');

  // const parentNode = document.getElementsByTagName('body')?.[0];
  const parentNode = document.getElementById('videoParent');

  const element = document.createElement('pre');

  element.id = 'subtitle';
  element.classList.add(className);

  parentNode?.appendChild(element);

  /**
   * Callback function. It receives the SUBTITLE_UPDATE event with the next object
   * @param {Object} event
   * @param {String} event.text
   * @param {CUE} [event.cue] CUE object @link{@accedo/xdk-players-contrib~CUE}
   *
   */
  // eslint-disable-next-line no-unused-vars
  return ({ text }) => {
    // converts the cue <c.color.background> to <c class="color background">
    element.innerHTML = unescape(
      text
        .replace(/(<c)\.([a-zA-Z0-9]*\.?([a-zA-Z_]*)?)/g, '$1 class="$2 $3"')
        .replace(/(\/c)\.([a-zA-Z]*)/g, '$1')
    );
  };
  // }
};

export default getSubtitleRenderer;

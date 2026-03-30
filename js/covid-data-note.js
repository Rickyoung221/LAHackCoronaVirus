/**
 * index.html covid banner copy: GeoJSON vs CSV vs live markets (data.lacity.org).
 */
(function (global) {
  'use strict';

  function covidDataBannerHtmlOk(keyCount) {
    return (
      '<strong>Data note:</strong> <code>lacityboundry.geojson</code> is boundaries only and does <em>not</em> include case counts (nothing was “removed” by the city). ' +
      'Counts come from the checked-in snapshot <code>coronavirus.csv</code> (~2020 county health page scrape, <strong>not real-time</strong>), matched by city/community name (~' +
      keyCount +
      ' keys indexed). ' +
      'Market pins still come from <code>data.lacity.org</code> (separate from the CSV).'
    );
  }

  function covidDataBannerHtmlErr(detail) {
    return (
      '<strong>Could not load</strong> <code>coronavirus.csv</code> (' +
      (detail || 'unknown error') +
      '). ' +
      'Serve this site over HTTP (do not use <code>file://</code>). Popups will show “no match” for cases.'
    );
  }

  global.covidDataBannerHtmlOk = covidDataBannerHtmlOk;
  global.covidDataBannerHtmlErr = covidDataBannerHtmlErr;
})(typeof window !== 'undefined' ? window : this);

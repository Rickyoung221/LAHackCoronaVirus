/**
 * index.html map + COVID CSV / GeoJSON (no inline script — CSP-friendly).
 */
(function () {
  'use strict';

  var MAP_ID = 'DEMO_MAP_ID';

  var contentString =
    '<div id="content">' +
    '<div id="siteNotice">' +
    '</div>' +
    '<h1 id="firstHeading" class="firstHeading">Los Angeles</h1>' +
    '<div id="bodyContent">' +
    '<p><b>Los Angeles</b>, a city </p>' +
    '</div>' +
    '</div>';

  var map;
  var markers = [];
  /** GeoJSON click popup; assigned in cityboundries() */
  var infoWindow;
  var AdvancedMarkerElementCtor;

  async function initMap() {
    var markerLib = await google.maps.importLibrary('marker');
    AdvancedMarkerElementCtor = markerLib.AdvancedMarkerElement;

    map = new google.maps.Map(document.getElementById('map'), {
      zoom: 11,
      mapId: MAP_ID,
    });
    var geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: 'Los Angeles' }, function (results, status) {
      if (status === 'OK') {
        map.setCenter(results[0].geometry.location);
        var marker = new AdvancedMarkerElementCtor({
          map: map,
          position: results[0].geometry.location,
        });
        markers.push(marker);
        var laMarkerInfo = new google.maps.InfoWindow({
          content: contentString,
        });
        marker.addListener('gmp-click', function () {
          laMarkerInfo.open(map, marker);
        });
      } else {
        window.alert('Geocode was not successful for the following reason: ' + status);
      }
    });
    document.getElementById('submit').addEventListener('click', function () {
      geocodeAddress(geocoder, map);
    });
    loadCovidCsv().then(function () {
      cityboundries();
    });
  }

  function setMapOnAll(m) {
    for (var i = 0; i < markers.length; i++) {
      markers[i].map = m;
    }
  }

  function clearMarkers() {
    setMapOnAll(null);
  }

  function showMarkers() {
    setMapOnAll(map);
  }

  function deleteMarkers() {
    clearMarkers();
    markers = [];
  }

  function geocodeAddress(geocoder, resultsMap) {
    var address = document.getElementById('address').value;
    geocoder.geocode({ address: address }, function (results, status) {
      if (status === 'OK') {
        resultsMap.setCenter(results[0].geometry.location);
        var marker = new AdvancedMarkerElementCtor({
          map: resultsMap,
          position: results[0].geometry.location,
        });
        markers.push(marker);
      } else {
        alert('Geocode was not successful for the following reason: ' + status);
      }
    });
  }

  var covidCaseMap = {};

  function normPlaceKey(s) {
    return String(s || '')
      .replace(/\*+$/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  function parseCovidCsv(text) {
    var m = {};
    var inCities = false;
    var lines = text.split(/\r?\n/);
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (line.indexOf('CITY/COMMUNITY') === 0) {
        inCities = true;
        continue;
      }
      if (!inCities) continue;
      var ix = line.indexOf(',');
      if (ix < 0) continue;
      var left = line.slice(0, ix).trim();
      var right = line.slice(ix + 1).trim();
      if (!left) continue;
      var fullKey = normPlaceKey(left);
      m[fullKey] = right;
      if (/^city of\s+/i.test(left)) {
        var shortName = normPlaceKey(left.replace(/^city of\s+/i, ''));
        if (shortName) m[shortName] = right;
      }
    }
    return m;
  }

  function lookupCovidCase(cityName, cityLabel) {
    var cm = covidCaseMap;
    var tryKeys = [];
    if (cityName) tryKeys.push(normPlaceKey(cityName));
    if (cityLabel && cityLabel !== cityName) tryKeys.push(normPlaceKey(cityLabel));
    for (var t = 0; t < tryKeys.length; t++) {
      var k = tryKeys[t];
      if (k && cm[k] !== undefined) return cm[k];
    }
    if (cityName) {
      var cityOf = normPlaceKey('City of ' + cityName);
      if (cm[cityOf] !== undefined) return cm[cityOf];
    }
    return null;
  }

  function formatCaseForDisplay(raw) {
    if (raw === null || raw === undefined) return null;
    var s = String(raw).trim();
    if (s === '--') return '— ("--" in CSV: small areas may be 1–4 cases or suppressed)';
    return s;
  }

  function setCovidBanner(kind, detail) {
    var el = document.getElementById('covid-data-banner');
    if (!el) return;
    if (kind === 'ok') {
      el.innerHTML = covidDataBannerHtmlOk(detail);
    } else {
      el.innerHTML = covidDataBannerHtmlErr(detail);
    }
  }

  function loadCovidCsv() {
    return fetch('coronavirus.csv')
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      })
      .then(function (text) {
        covidCaseMap = parseCovidCsv(text);
        var n = Object.keys(covidCaseMap).length;
        setCovidBanner('ok', n);
      })
      .catch(function (e) {
        covidCaseMap = {};
        setCovidBanner('err', e.message || String(e));
      });
  }

  function cityboundries() {
    infoWindow = new google.maps.InfoWindow({
      content: '',
    });
    map.data.loadGeoJson('lacityboundry.geojson');
    map.data.setStyle(function (feature) {
      var color = 'gray';
      if (feature.getProperty('isColorful')) {
        color = feature.getProperty('color');
      }
      return {
        fillColor: color,
        strokeColor: color,
        strokeWeight: 1.2,
        fillOpacity: 0.3,
      };
    });

    map.data.addListener('click', function (event) {
      map.data.overrideStyle(event.feature, {
        fillColor: '#3399FF',
        fillOpacity: 0.3,
        strokeOpacity: 0.7,
        strokeWeight: 3.5,
      });

      var rawGeo = event.feature.getProperty('value');
      var cityName = event.feature.getProperty('city_name') || '';
      var cityLab = event.feature.getProperty('city_label') || '';
      var placeTitle = cityName || cityLab || '—';
      if (cityLab && cityName && cityLab !== cityName) {
        placeTitle = cityName + ' (' + cityLab + ')';
      }
      var caseDisplay;
      if (
        rawGeo !== undefined &&
        rawGeo !== null &&
        rawGeo !== '' &&
        !(typeof rawGeo === 'number' && isNaN(rawGeo))
      ) {
        caseDisplay = String(rawGeo);
      } else {
        var fromCsv = lookupCovidCase(cityName, cityLab);
        var formatted = formatCaseForDisplay(fromCsv);
        if (formatted !== null) {
          caseDisplay =
            formatted + " <span style='color:#555;font-size:12px'>(coronavirus.csv snapshot)</span>";
        } else if (normPlaceKey(cityName) === 'unincorporated') {
          caseDisplay =
            'Unincorporated: the CSV lists many "Unincorporated …" rows; this polygon is not tied to one row—see the CSV or the county site.';
        } else {
          caseDisplay = 'No matching name in this CSV snapshot (naming differs or not listed).';
        }
      }
      infoWindow.setContent(
        '<div style="line-height:1.35;max-width:300px;white-space:normal;">Area: ' +
          placeTitle +
          '<br/>Confirmed cases (display only): ' +
          caseDisplay +
          '</div>'
      );
      var anchor = new google.maps.MVCObject();
      anchor.set('position', event.latLng);
      infoWindow.open(map, anchor);
    });

    map.data.addListener('mousedown', function () {
      map.data.revertStyle();
    });
  }

  window.initMap = initMap;
  window.clearMarkers = clearMarkers;
  window.showMarkers = showMarkers;
  window.deleteMarkers = deleteMarkers;

  function bindPanelButtons() {
    var hideBtn = document.getElementById('btn-clear-markers');
    var showBtn = document.getElementById('btn-show-markers');
    var delBtn = document.getElementById('btn-delete-markers');
    if (hideBtn) hideBtn.addEventListener('click', clearMarkers);
    if (showBtn) showBtn.addEventListener('click', showMarkers);
    if (delBtn) delBtn.addEventListener('click', deleteMarkers);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindPanelButtons);
  } else {
    bindPanelButtons();
  }
})();

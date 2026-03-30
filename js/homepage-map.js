/**
 * Homepage map: L.A. certified retail markets (Socrata XML), optional neighborhood context layer,
 * Places SearchBox + Geocoder, driving-distance table. window.initAutocomplete = Maps callback.
 *
 * Market pins use classic google.maps.Marker (no mapId) so markers show with any valid Maps JS key.
 * Flow: map loads → loadMarkets() XHRs XML → up to MAX_MARKET_PINS markers appear without searching.
 * Search only adds an origin pin + distance table.
 */
(function (global) {
  'use strict';

  var LA_CENTER = { lat: 34.0522, lng: -118.43 };
  var DEFAULT_ZOOM = 12;
  var MARKETS_XML =
    'https://data.lacity.org/api/views/g986-7yf9/rows.xml?accessType=DOWNLOAD';
  var MAX_MARKET_PINS = 400;
  var DIST_MATRIX_DEST_CAP = 25;

  function downloadUrl(url, callback) {
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        xhr.onreadystatechange = function () {};
        callback(xhr, xhr.status);
      }
    };
    xhr.open('GET', url, true);
    xhr.send(null);
  }

  function coliFillColor(coli) {
    var colors = ['#d1ccad', '#89a844', '#ad9202', '#a85d02', '#8a0e26'];
    if (coli >= 15) return colors[4];
    if (coli > 10) return colors[3];
    if (coli > 5) return colors[2];
    if (coli > 0) return colors[1];
    return colors[0];
  }

  function marketRowName(row) {
    var dba = row.getElementsByTagName('dba_name')[0];
    if (dba && dba.childNodes[0]) return dba.childNodes[0].data;
    var bn = row.getElementsByTagName('business_name')[0];
    if (bn && bn.childNodes[0]) return bn.childNodes[0].data;
    return 'Market';
  }

  function marketRowStreet(row) {
    var s = row.getElementsByTagName('street_address')[0];
    return s && s.childNodes[0] ? s.childNodes[0].data : '';
  }

  function placeIconSpec(iconUrl) {
    if (!iconUrl) return null;
    return {
      url: iconUrl,
      scaledSize: new google.maps.Size(25, 25),
      origin: new google.maps.Point(0, 0),
      anchor: new google.maps.Point(12, 25),
    };
  }

  function appendSortedDistanceRows(outputDiv, destNames, destinationList, results) {
    var disSorted = [];
    var j;
    for (j = 0; j < results.length; j++) {
      if (results[j].distance !== undefined) {
        disSorted.push({ value: results[j].distance.value, index: j });
      }
    }
    disSorted.sort(function (a, b) {
      return a.value - b.value;
    });

    var html = '';
    for (j = 0; j < disSorted.length; j++) {
      var rankCell;
      if (j === 0) {
        rankCell =
          '<h2 style="color:gold" class="ui center aligned header">#' + (j + 1) + '</h2>';
      } else if (j === 1) {
        rankCell =
          '<h2 style="color:silver" class="ui center aligned header">#' + (j + 1) + '</h2>';
      } else if (j === 2) {
        rankCell =
          '<h2 style="color:brown" class="ui center aligned header">#' + (j + 1) + '</h2>';
      } else {
        rankCell = '<h3 class="ui center aligned">#' + (j + 1) + '</h3>';
      }
      var idx = disSorted[j].index;
      html +=
        '<tr><td>' +
        rankCell +
        '</td><td>' +
        destNames[idx] +
        '</td><td>' +
        results[idx].distance.text +
        '</td><td>' +
        destinationList[idx] +
        '</td></tr>';
    }
    outputDiv.innerHTML += html;
  }

  function initAutocomplete() {
    var map = new google.maps.Map(document.getElementById('map'), {
      center: LA_CENTER,
      zoom: DEFAULT_ZOOM,
      mapTypeId: 'roadmap',
    });

    var marketInfoWindow = new google.maps.InfoWindow();
    var hoodInfoWindow = new google.maps.InfoWindow({ content: '' });

    var rows = null;
    var marketsReady = false;
    var searchMarkers = [];

    function setMarketLoadStatus(msg) {
      var el = document.getElementById('market-load-status');
      if (el) el.textContent = msg;
    }

    function loadMarkets() {
      if (typeof fetch !== 'function') {
        downloadUrl(MARKETS_XML, function (req) {
          if (req.status !== 200 && req.status !== 0) {
            marketsReady = true;
            setMarketLoadStatus('Market list request failed (HTTP ' + req.status + ').');
            return;
          }
          var xml = lacityParseSocrataXmlFromXhr(req);
          applyMarketsFromXmlDoc(xml);
        });
        return;
      }

      fetch(MARKETS_XML, { mode: 'cors', credentials: 'omit' })
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.text();
        })
        .then(function (text) {
          var doc = new DOMParser().parseFromString(text, 'application/xml');
          if (doc.getElementsByTagName('parsererror').length) {
            throw new Error('Invalid XML');
          }
          applyMarketsFromXmlDoc(doc);
        })
        .catch(function (err) {
          marketsReady = true;
          rows = rows || [];
          var hint = '';
          if (typeof location !== 'undefined' && location.protocol === 'file:') {
            hint =
              ' Cannot load from file:// — use a local server (e.g. npm run dev) or open the built site over http/https.';
          }
          setMarketLoadStatus('Could not load market data from data.lacity.org.' + hint + ' (' + (err && err.message) + ')');
          if (typeof console !== 'undefined' && console.warn) {
            console.warn('loadMarkets:', err);
          }
        });
    }

    function applyMarketsFromXmlDoc(xml) {
      if (!xml) {
        marketsReady = true;
        setMarketLoadStatus('Could not parse market XML (empty response).');
        return;
      }
      rows = xml.getElementsByTagName('row');

      var count = 0;
      Array.prototype.forEach.call(rows, function (row) {
        if (!lacityIsLeafMarketRow(row) || count >= MAX_MARKET_PINS) return;
        var loc = lacityParseLocation1(row.getElementsByTagName('location_1')[0]);
        if (!loc) return;

        var name = marketRowName(row);
        var street = marketRowStreet(row);
        var point = new google.maps.LatLng(loc.lat, loc.lng);

        var body = document.createElement('div');
        var strong = document.createElement('strong');
        strong.textContent = name;
        body.appendChild(strong);
        body.appendChild(document.createElement('br'));
        var line = document.createElement('span');
        line.textContent = street;
        body.appendChild(line);

        try {
          var marker = new google.maps.Marker({
            map: map,
            position: point,
            label: 'M',
            title: name,
            optimized: false,
          });
          marker.addListener('click', function () {
            marketInfoWindow.setContent(body);
            marketInfoWindow.open(map, marker);
          });
          count++;
        } catch (e) {
          if (typeof console !== 'undefined' && console.warn) {
            console.warn('Marker failed', name, e);
          }
        }
      });

      marketsReady = true;
      setMarketLoadStatus(
        count > 0
          ? 'Showing ' + count + ' markets on the map (max ' + MAX_MARKET_PINS + ').'
          : 'No market pins: check console / network, or open over http(s) not file://.'
      );
    }

    function loadNeighborhoodLayer() {
      var layer = new google.maps.Data();
      layer.loadGeoJson('Neighborhoods.geojson');
      layer.setStyle(function (feature) {
        return {
          fillColor: coliFillColor(feature.getProperty('COLI')),
          fillOpacity: 0.22,
          strokeColor: '#b3b3b3',
          strokeWeight: 1,
          zIndex: 0,
        };
      });
      layer.addListener('mouseover', function (e) {
        layer.overrideStyle(e.feature, {
          strokeColor: '#2a2a2a',
          strokeWeight: 2,
          zIndex: 2,
        });
      });
      layer.addListener('mouseout', function () {
        layer.revertStyle();
      });
      layer.addListener('click', function (e) {
        var hoodName = e.feature.getProperty('name') || '—';
        var coli = e.feature.getProperty('COLI');
        hoodInfoWindow.setContent(
          '<div style="line-height:1.35;max-width:280px;white-space:normal">' +
            '<strong>' +
            hoodName +
            '</strong><br>' +
            '<span style="font-size:12px;color:#444">Neighborhood council boundary (City of L.A.). ' +
            'Field <code>COLI</code> in this GeoJSON is a legacy dataset value — not live public-health data.</span><br>' +
            '<span style="font-size:12px">COLI: ' +
            (coli !== undefined && coli !== null ? String(coli) : '—') +
            '</span></div>'
        );
        var anchor = new google.maps.MVCObject();
        anchor.set('position', e.latLng);
        hoodInfoWindow.open(map, anchor);
      });
      layer.setMap(map);
    }

    function handleSearchOrigin(latLng, title, viewport, iconSpec) {
      if (!marketsReady || !rows) {
        alert('Market data is still loading. Please wait a few seconds and try again.');
        return;
      }

      searchMarkers.forEach(function (m) {
        m.setMap(null);
      });
      searchMarkers = [];

      var markerOpts = {
        map: map,
        position: latLng,
        title: title || 'Selected place',
        animation: google.maps.Animation.DROP,
      };
      var spec = iconSpec && iconSpec.url ? placeIconSpec(iconSpec.url) : null;
      if (spec) markerOpts.icon = spec;
      searchMarkers.push(new google.maps.Marker(markerOpts));

      if (viewport) {
        map.fitBounds(viewport);
      } else {
        map.setCenter(latLng);
        if (map.getZoom() < 12) map.setZoom(13);
      }

      var origin = latLng.toJSON();
      var destinations = [];
      var destNames = [];
      var n = 0;
      Array.prototype.forEach.call(rows, function (row) {
        if (n >= DIST_MATRIX_DEST_CAP) return;
        if (!lacityIsLeafMarketRow(row)) return;
        var loc = lacityParseLocation1(row.getElementsByTagName('location_1')[0]);
        if (!loc) return;
        destinations.push({ lat: loc.lat, lng: loc.lng });
        destNames.push(marketRowName(row));
        n++;
      });

      var outputDiv = document.getElementById('output');
      outputDiv.innerHTML =
        '<tr><td colspan="4"><div class="ui active centered inline loader"></div> ' +
        '<span class="ui text">Calculating driving distances…</span></td></tr>';

      new google.maps.DistanceMatrixService().getDistanceMatrix(
        {
          origins: [origin],
          destinations: destinations,
          travelMode: 'DRIVING',
          unitSystem: google.maps.UnitSystem.METRIC,
          avoidHighways: false,
          avoidTolls: false,
        },
        function (response, status) {
          if (status !== 'OK') {
            outputDiv.innerHTML =
              '<tr><td colspan="4"><div class="ui negative message" style="margin:0">' +
              '<div class="header">Distance request failed</div><p>' +
              status +
              '</p></div></td></tr>';
            return;
          }
          outputDiv.innerHTML = '';
          appendSortedDistanceRows(
            outputDiv,
            destNames,
            response.destinationAddresses,
            response.rows[0].elements
          );
        }
      );
    }

    function bindSearchUi() {
      var input = document.getElementById('pac-input');
      if (!input) return;

      var searchBox = new google.maps.places.SearchBox(input);
      map.addListener('bounds_changed', function () {
        searchBox.setBounds(map.getBounds());
      });

      searchBox.addListener('places_changed', function () {
        var places = searchBox.getPlaces();
        if (!places.length) return;
        var p = places[0];
        if (!p.geometry || !p.geometry.location) return;
        handleSearchOrigin(
          p.geometry.location,
          p.name,
          p.geometry.viewport,
          { url: p.icon || null }
        );
      });

      var geocoder = new google.maps.Geocoder();
      function runGeocodedSearch() {
        var q = input.value.trim();
        if (!q) return;
        geocoder.geocode(
          { address: q, bounds: map.getBounds(), region: 'US' },
          function (results, status) {
            if (status !== 'OK' || !results[0]) {
              alert('Could not find that place. Try a more specific address.');
              return;
            }
            var r = results[0];
            handleSearchOrigin(
              r.geometry.location,
              r.formatted_address,
              r.geometry.viewport,
              null
            );
          }
        );
      }

      var btn = document.getElementById('pac-search-btn');
      if (btn) btn.addEventListener('click', runGeocodedSearch);
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          runGeocodedSearch();
        }
      });
    }

    loadMarkets();
    loadNeighborhoodLayer();
    bindSearchUi();
  }

  global.initAutocomplete = initAutocomplete;

  if (typeof jQuery !== 'undefined') {
    jQuery(function ($) {
      $('a[href*="#"]').on('click', function (e) {
        e.preventDefault();
        var target = $(this).attr('href');
        if (!target || target.length < 2) return;
        var $el = $(target);
        if ($el.length) {
          $('html, body').animate({ scrollTop: $el.offset().top }, 500, 'linear');
        }
      });
    });
  }
})(typeof window !== 'undefined' ? window : this);

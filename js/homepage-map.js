/**
 * Homepage map: LA markets (Socrata XML), neighborhood GeoJSON, Places SearchBox + Geocoder.
 * Exposes window.initAutocomplete for the Google Maps script callback.
 */
(function (global) {
  'use strict';

  var LA_CENTER = { lat: 34.0522, lng: -118.43 };
  var DEFAULT_ZOOM = 12;
  var MARKETS_XML =
    'https://data.lacity.org/api/views/g986-7yf9/rows.xml?accessType=DOWNLOAD';
  var MAX_MARKET_PINS = 400;
  var DIST_MATRIX_DEST_CAP = 25;
  /** Required for AdvancedMarkerElement; create your own in Google Cloud → Map Management for production. */
  var MAP_ID = 'DEMO_MAP_ID';

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
    return row.getElementsByTagName('business_name')[0].childNodes[0].data;
  }

  function marketRowStreet(row) {
    return row.getElementsByTagName('street_address')[0].childNodes[0].data;
  }

  function placeIconUrl(place) {
    return place && place.icon ? place.icon : null;
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

  async function initAutocomplete() {
    var markerLib = await google.maps.importLibrary('marker');
    var AdvancedMarkerElement = markerLib.AdvancedMarkerElement;
    var PinElement = markerLib.PinElement;

    var map = new google.maps.Map(document.getElementById('map'), {
      center: LA_CENTER,
      zoom: DEFAULT_ZOOM,
      mapTypeId: 'roadmap',
      mapId: MAP_ID,
    });

    var marketInfoWindow = new google.maps.InfoWindow();
    var hoodInfoWindow = new google.maps.InfoWindow({ content: '' });

    var rows = null;
    var marketsReady = false;
    var searchMarkers = [];

    function loadMarkets() {
      downloadUrl(MARKETS_XML, function (req) {
        var xml = req.responseXML;
        if (!xml) return;
        rows = xml.getElementsByTagName('row');
        marketsReady = true;

        var count = 0;
        Array.prototype.forEach.call(rows, function (row) {
          if (row.children.length >= 100 || count >= MAX_MARKET_PINS) return;
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

          var pin = new PinElement({
            background: '#1a73e8',
            borderColor: '#174ea6',
            glyph: 'M',
            glyphColor: 'white',
          });
          var marker = new AdvancedMarkerElement({
            map: map,
            position: point,
            content: pin.element,
            title: name,
          });
          marker.addListener('gmp-click', function () {
            marketInfoWindow.setContent(body);
            marketInfoWindow.open(map, marker);
          });
          count++;
        });
      });
    }

    function loadNeighborhoodLayer() {
      var layer = new google.maps.Data();
      layer.loadGeoJson('Neighborhoods.geojson');
      layer.setStyle(function (feature) {
        return {
          fillColor: coliFillColor(feature.getProperty('COLI')),
          fillOpacity: 0.6,
          strokeColor: '#b3b3b3',
          strokeWeight: 1,
          zIndex: 1,
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
        hoodInfoWindow.setContent(
          '<div style="line-height:1;overflow:hidden;white-space:nowrap">' +
            e.feature.getProperty('name') +
            '<br> COVID-19 confirmed: ' +
            e.feature.getProperty('COLI') +
            '</div>'
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
        m.map = null;
      });
      searchMarkers = [];

      var contentEl = null;
      var iconUrl = iconSpec && iconSpec.url ? iconSpec.url : null;
      if (iconUrl) {
        contentEl = document.createElement('img');
        contentEl.src = iconUrl;
        contentEl.alt = '';
        contentEl.width = 25;
        contentEl.height = 25;
      } else {
        contentEl = new PinElement({
          background: '#db4437',
          borderColor: '#c5221f',
          glyphColor: '#fff',
        }).element;
      }
      searchMarkers.push(
        new AdvancedMarkerElement({
          map: map,
          position: latLng,
          content: contentEl,
          title: title || 'Selected place',
        })
      );

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
          { url: placeIconUrl(p) }
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

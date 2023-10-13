// https://github.com/Leaflet/Leaflet/blob//src/geo/projection/Projection.Mercator.js#L12C8-L30C3

const earthRadius = 6378137;

const SphericalMercator = {

	R: earthRadius,
	MAX_LATITUDE: 85.0511287798,

	project(latlng) {
		const d = Math.PI / 180,
		    mx = this.MAX_LATITUDE,
		    lat = Math.max(Math.min(mx, latlng[0]), -mx),
		    sn = Math.sin(lat * d);

		return [
			this.R * latlng[1] * d,
			this.R * Math.log((1 + sn) / (1 - sn)) / 2
        ];
	},
  	unproject(point) {
		const d = 180 / Math.PI;

		return [
          (2 * Math.atan(Math.exp(point[1] / this.R)) - (Math.PI / 2)) * d,
			point[0] * d / this.R
        ];
	},

};

function latLngToTile(latlng) {
  let scale = Math.pow(2, zoomlvl)
  let point = SphericalMercator.project(latlng)
  // scale = scale || 1;
  let sc = 0.5 / (Math.PI * SphericalMercator.R);
  point[0] = scale * (sc * point[0] + 0.5);
  point[1] = scale * (-sc * point[1] + 0.5);
  return point;
}

function tileToLatLng(point) {
  let scale = Math.pow(2, zoomlvl);
  let sc = 0.5 / (Math.PI * SphericalMercator.R);
  point[0] = (point[0]/scale - 0.5)/sc;
  point[1] = -(point[1]/scale - 0.5)/sc;
  return SphericalMercator.unproject(point);
}

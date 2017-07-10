'use strict';

class FeatureList {

    constructor() {
        this.features = []
    }

    add(properties, geometry) {
        let feature = {
            type: "Feature",
            geometry: geometry,
            properties: properties
        };

        this.features.add(feature);
    }

    getFeatures() {
        return this.features;
    }

    static createFromGeoJson(json) {
        let data = JSON.parse(json);

        // TODO: Check if JSON parsing succeeded?

        return FeatureList.createFromArray(data)
    }

    static createFromArray(array) {
        if (!"features" in obj) {
            throw new Error("Supplied JSON does not contain required object 'features'");
        }

        let instance = new FeatureList();
        let features = array.features;

        for (let i in features) {
            instance.add(features[i].properties, features[i].geometry)
        }

        return instance;
    }
}

module.exports = FeatureList;
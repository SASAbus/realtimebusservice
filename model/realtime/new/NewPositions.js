'use strict';

const connection = require("../../../database/connection");
const config = require("../../../config");

const NewFeatureList = require("../new/NewFeatureList");
const LineUtils = require("../LineUtils");

module.exports = class NewPositions {

    constructor() {
        this.outputFormat = config.output_coordinate_format;
    }

    setLines(lines) {
        this.lines = lines;
    }

    getAll() {
        return Promise.resolve()
            .then(() => {
                let whereLines = '';

                if (typeof this.lines !== 'undefined' && this.lines.length > 0) {
                    console.info(`Filter is enabled: lines='${this.lines}'`);
                    whereLines = " AND (" + LineUtils.whereLines('rec_frt.li_nr', 'rec_frt.str_li_var', this.lines) + ")";
                }

                return `
                    SELECT DISTINCT (vehicleCode),
                        rec_frt.frt_fid,
                        gps_date,
                        delay_sec,
                        vehicleCode,
                        rec_frt.li_nr,
                        rec_frt.str_li_var,
                        lidname,
                        insert_date,
                        next_rec_ort.ort_nr AS ort_nr,
                        next_rec_ort.onr_typ_nr AS onr_typ_nr,
                        next_rec_ort.ort_name AS ort_name,
                        next_rec_ort.ort_ref_ort_name AS ort_ref_ort_name,
                        ST_AsGeoJSON(ST_Transform(vehicle_position_act.the_geom, ${this.outputFormat})) AS json_geom,
                        ST_AsGeoJSON(ST_Transform(vehicle_position_act.extrapolation_geom, ${this.outputFormat})) AS json_extrapolation_geom
                        
                    FROM vdv.vehicle_position_act
                    
                    INNER JOIN vdv.rec_frt
                        ON vehicle_position_act.frt_fid=rec_frt.teq_nummer
                        
                    INNER JOIN vdv.rec_lid
                        ON rec_frt.li_nr=rec_lid.li_nr
                        AND rec_frt.str_li_var=rec_lid.str_li_var
                        
                    LEFT JOIN vdv.lid_verlauf lid_verlauf_next
                        ON rec_frt.li_nr=lid_verlauf_next.li_nr
                        AND rec_frt.str_li_var=lid_verlauf_next.str_li_var
                        AND vehicle_position_act.li_lfd_nr + 1 = lid_verlauf_next.li_lfd_nr
                    
                    LEFT JOIN vdv.rec_ort next_rec_ort
                        ON lid_verlauf_next.onr_typ_nr=next_rec_ort.onr_typ_nr
                        AND lid_verlauf_next.ort_nr=next_rec_ort.ort_nr
                        
                    LEFT JOIN vdv.line_attributes
                        ON rec_frt.li_nr=line_attributes.li_nr
                        
                    WHERE gps_date > NOW() - interval '${config.realtime_bus_timeout_minutes} minute'
                    -- AND vehicle_position_act.status='r'
                    
                    ORDER BY gps_date
                    
                    
                    ${whereLines}
               `
            })
            .then(sql => connection.query(sql))
            .then(result => {
                // console.log(result);

                let featureList = new NewFeatureList();

                for (let row of result.rows) {
                    // console.log(row);

                    let geometry;

                    // noinspection EqualityComparisonWithCoercionJS
                    if (row.json_extrapolation_geom != null) {
                        geometry = JSON.parse(row.json_extrapolation_geom);
                    } else {
                        geometry = JSON.parse(row.json_geom);
                    }

                    delete row.json_geom;
                    delete row.json_extrapolation_geom;

                    let feature = {
                        trip: parseInt(row.frt_fid),
                        line_id: row.li_nr,
                        line_name: row.lidname,
                        variant: parseInt(row.str_li_var),
                        vehicle: parseInt(row.vehiclecode.split(" ")[0]),
                        delay_min: Math.round(row.delay_sec / 60),
                        latitude: Math.round(geometry.coordinates[1] * 1000000) / 1000000,
                        longitude: Math.round(geometry.coordinates[0] * 1000000) / 1000000,
                        bus_stop: row.ort_nr,
                        inserted: row.insert_date,
                        updated: row.gps_date,
                    };

                    featureList.add(feature);
                }

                return featureList.getBusCollection();
            });
    }
};
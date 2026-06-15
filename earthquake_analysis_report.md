# Myanmar Earthquake & Tectonic Association Analysis Report

This report presents a comprehensive spatial and non-spatial analysis of Myanmar's seismicity, using 57 recent earthquake events from the Department of Meteorology and Hydrology (DMH) (`dmh_myanmar_earthquake_data.geojson`) and lineament structures from the `Myanmar_Tectonic_Map_2011.geojson`.

---

## 1. Executive Summary

During the period from **January 14, 2026 to June 15, 2026**, 57 seismic events were recorded across Myanmar, ranging in magnitude from **3.1 to 6.0 Mw** and in hypocentral depth from **5 km to 145 km**. 

By calculating the geodesic distance from each earthquake epicenter to the nearest tectonic fault, this study reveals a high spatial correlation between tectonic structures and seismicity. Specifically, **86.0%** of all earthquakes occurred within **20 km** of a mapped fault lineament, and **35.1%** occurred within **5 km**.

**Data Source:** Department of Meteorology and Hydrology (DMH), Myanmar

---

## 2. Spatial Analysis Results

### 2.1 Fault Distance Metrics
Using flat coordinate projection approximations for geodesic distance calculations, the spatial relationship between hypocenters and faults was quantified:
* **Average Distance to Nearest Fault**: 12.88 km
* **Minimum Distance to a Fault**: 0.05 km (highly correlated event)
* **Maximum Distance to a Fault**: 94.30 km

### 2.2 Proximity Distribution
The table below illustrates the distribution of earthquakes relative to the nearest tectonic lineaments:

| Distance Range (km) | Count | Percentage | Description |
|---|---|---|---|
| **&le; 5 km** | 20 | 35.1% | Direct fault-line events |
| **5 to 10 km** | 11 | 19.3% | Immediate fault proximity |
| **10 to 20 km** | 18 | 31.6% | Regional structural influence |
| **20 to 50 km** | 6 | 10.5% | Peripheral seismicity |
| **&gt; 50 km** | 2 | 3.5% | Intraplate / Off-fault events |

### 2.3 Named Fault Associations
Out of 632 tectonic segments, only 1.6% (10 features) have explicit names in the source database. The distance to these named features was calculated separately to identify closest major structures:

* **Shweli Fault**: Closest named structure for **31 earthquakes** (Average distance: ~225 km)
* **Mong Hpyak Fault**: Closest named structure for **16 earthquakes** (Average distance: ~310 km)
* **Kyaukkyan Fault**: Closest named structure for **9 earthquakes** (Average distance: ~360 km)
* **Kyaukme Fault**: Closest named structure for **1 earthquake** (Average distance: ~280 km)

> [!NOTE]
> The large distance averages for named faults are due to the sparse attribute data in the 2011 map. Major tectonic elements (such as the central Sagaing Fault) are present geometrically but lack name strings in the GeoJSON attributes, meaning they default to "Unnamed Tectonic Lineament" for the primary spatial queries.

---

## 3. Non-Spatial Analysis Results

### 3.1 Magnitude Distribution
The dataset comprises low-to-moderate magnitude events:
* **Minor (3.0–3.9 Mw)**: 28 events (49.1%)
* **Light (4.0–4.9 Mw)**: 23 events (40.4%)
* **Moderate (5.0–5.9 Mw)**: 5 events (8.8%)
* **Strong (6.0 Mw)**: 1 event (1.8%)

The maximum magnitude event of **6.0 Mw** occurred on **May 3, 2026**, located *18 miles ENE of Homalin*.

### 3.2 Depth and Hypocenter Trends
Hypocentral depth plays a critical role in determining potential shaking intensity on the surface:
* **Shallow (0–30 km)**: 36 events (63.2%) — typically crustal faults.
* **Intermediate (30–70 km)**: 9 events (15.8%) — lower crustal boundaries.
* **Deep (&gt;70 km)**: 12 events (21.1%) — subduction-related activity (primarily in western Myanmar near the Indo-Myanmar range, with depths reaching up to 145 km).

---

## 4. Methodology & Data Processing

To enable real-time interactive performance without requesting third-party GIS installations (preserving user storage), a custom data processing script `process_spatial_data.py` was executed:

1. **Local Plane Projection**: Epicenters and fault nodes were projected onto a local flat plane in kilometers using:
   $$y = \text{Latitude} \times 110.574\text{ km/deg}$$
   $$x = \text{Longitude} \times 111.320 \times \cos(\text{Latitude}_{\text{radians}})\text{ km/deg}$$
2. **Segment Projections**: For each earthquake epicenter $P$, the shortest distance to each line segment $AB$ of the tectonic lineament dataset was evaluated using the vector projection parameter:
   $$t = \frac{\vec{AP} \cdot \vec{AB}}{\|\vec{AB}\|^2}$$
   clamped to $[0, 1]$ to calculate the exact distance to the nearest point on the line segment.
3. **Seismic Enrichment**: The original earthquake features were appended with properties:
   - `Nearest_Fault_Name`, `Nearest_Fault_Code`, `Distance_to_Fault_km`
   - `Nearest_Named_Fault_Name`, `Distance_to_Named_Fault_km`
   - `Magnitude_Class`, `Depth_Class`
   These processed attributes were exported to `analyzed_earthquakes.json`.

---

## 5. Interactive Dashboard Guide

The web dashboard is structured to facilitate discovery:

* **Left Map Canvas**: Powered by Leaflet.js, displaying:
  - Base maps: Dark vector mode (for neon contrast) and Satellite view.
  - Earthquake locations: Circle markers sized exponentially by magnitude and color-coded by depth (Cyan = Shallow, Orange = Intermediate, Magenta = Deep).
  - Tectonic background: Styled as a **single-class coral lineament** background. Hovering highlights the fault segment, and clicking displays its segment details.
* **Right Panel (Charts)**: Three tabbed pages displaying:
  1. *Magnitude & Depth*: Distribution histograms and a hypocentral scatter plot (with geological y-axis inversion showing deeper earthquakes at the bottom).
  2. *Timeline & Trends*: A weekly line chart showing frequency trends over time.
  3. *Fault Relationship*: A doughnut chart of distance bins and a bar chart showing the closest named fault features.
* **Bottom Panel (Ledger Table)**: A sortable tabular layout of all events. Clicking any row pans the map and triggers the corresponding map popup.
* **Sidebar Controls**: Dynamic sliders for Magnitude, Depth, and Distance to Fault update all charts, counters, and map markers in real-time.

---
*Report compiled on June 15, 2026.*

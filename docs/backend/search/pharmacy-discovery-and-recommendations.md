# Pharmacy Recommendations & Discovery (Google s2 based approach)

### 1. Overview

The goal is to provide logged-in consumers with high-relevance pharmacy recommendations based on their current location or selected address. The system prioritizes accuracy by using **Google S2 Geometry** for spatial indexing to minimize heavy database calculations.

---

### 2. Functional Requirements

- **Mandatory Location:** User must provide coordinates (Lat/Lng) via device GPS or a selected address book entry.
- **Priority Logic:** Selected Address > Device Location.
- **Configurable Radius:** Default search radius is **10km** can be configured from server environment.
- **Strict Availability:** Only pharmacies with an `OPEN` status are displayed.
- **Textual Search:** Case-insensitive search on pharmacy name (max 50 chars).
- **No Pagination:** Results are limited to ~30 top matches for peak performance.
- **Caching**: (Post MVP) to cache the recommendations on the redis server based on s2 cellId for level 20 as people living in level20 cell are almost neighbhours.

---

### 3. Backend Implementation

#### A. Spatial Pruning (Google S2)

To avoid expensive Haversine calculations on every row in the database, we use S2 Cell IDs (Level 30) stored as `BIGINT` (Long in java).

![Google S2 Cell Covering](/images/s2.png)

1.  **S2Cap Creation:** A spherical cap is created centered at the user's location.
2.  **Region Covering:** The area is covered using a mix of cells (Levels 10 to 14).
3.  **Leaf Ranges:** For each covering cell, we extract the `min` and `max` S2 IDs for **Level 30**.
4.  **SQL Execution:** A `BETWEEN` query is executed against the indexed `s2_cell_id_l30` column. Number of BETWEEN conditions is directly dependendent on the number of cells covered inside the cap hence keeping an upper limit of `8` for now.

#### B. Component Interfaces

```java
/**
 * Utility for Google S2 Geometry calculations.
 */
interface S2Utils {
    /**
     * Returns the covering S2 cells for a given radius.
     * Uses Level 10-14 to balance accuracy and query complexity. Max number of cells limited to 8.
     */
    static List<S2CellId> getCellsUnderGivenRadius(GeoLocation center, Float radiusInKm);
}

/**
 * Repository layer using JPA Specifications for dynamic query building.
 */
interface StoreRepository extends JpaRepository<Store, Integer>, JpaSpecificationExecutor<Store> {

    /**
     * Executes a composite search:
     * 1. Spatial filter (OR-joined BETWEEN clauses)
     * 2. Name filter (LIKE query)
     * 3. Status filter (Fixed 'OPEN' status)
     */
    default List<Store> searchStores(List<Pair<Long, Long>> s2CellRanges, String searchQuery) {
        // Implementation logic using Jakarta Criteria API
    }
}
```

### 4 Database Logic (PostgreSQL)

The query utilizes the B-Tree index on s2_cell_id_l30 to quickly isolate the geographic region before applying name and status filters.

```sql
SELECT * FROM stores s
WHERE
    (
        s.s2_cell_id_l30 BETWEEN :min_cell_id1 AND :max_cell_id1 OR
        s.s2_cell_id_l30 BETWEEN :min_cell_id2 AND :max_cell_id2 OR
        -- ... up to 8 ranges
    )
    AND s.name ILIKE '%searchQuery%'
    AND s.store_status = 'OPEN'
LIMIT 30;
```

### 5. API Contract

Endpoint: POST /pharmacy/recommendations

Access: Consumer Role Only

Request Body:

```json
{
  "query": "Green Cross",
  "location": {
    "lat": 12.9716,
    "lng": 77.5946
  }
}
```

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Fetched pharmacies successfully.",
  "data": {
    "pharmacies": [
      {
        "id": "ph-001",
        "name": "Green Cross Apothecary",
        "images": [
          "https://example.com/img1.jpg",
          "https://example.com/img2.jpg"
        ],
        "estimatedDeliveryInMinutes": 25,
        "landmark": "Opposite Central Park",
        "distanceInKm": 1.2,
        "storeLocation": { "lat": 12.971, "lng": 77.594 }
      }
    ]
  },
  "errors": []
}
```

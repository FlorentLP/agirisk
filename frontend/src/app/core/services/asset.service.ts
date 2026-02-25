import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Asset, AssetCreate, AssetListParams, Cluster } from '../../models/asset.model';

const API_URL = 'http://localhost:8000/api/assets';

@Injectable({ providedIn: 'root' })
export class AssetService {
  constructor(private http: HttpClient) {}

  getList(params?: AssetListParams): Observable<Asset[]> {
    let httpParams = new HttpParams();
    if (params) {
      if (params.category) httpParams = httpParams.set('category', params.category);
      if (params.lat != null) httpParams = httpParams.set('lat', params.lat);
      if (params.lon != null) httpParams = httpParams.set('lon', params.lon);
      if (params.radius != null) httpParams = httpParams.set('radius', params.radius);
      if (params.polygon) httpParams = httpParams.set('polygon', params.polygon);
    }
    return this.http.get<Asset[]>(API_URL + '/', { params: httpParams });
  }

  getClusters(params?: Omit<AssetListParams, 'cluster'>): Observable<{ clusters: Cluster[] }> {
    let httpParams = new HttpParams().set('cluster', '1');
    if (params) {
      if (params.category) httpParams = httpParams.set('category', params.category);
      if (params.lat != null) httpParams = httpParams.set('lat', params.lat);
      if (params.lon != null) httpParams = httpParams.set('lon', params.lon);
      if (params.radius != null) httpParams = httpParams.set('radius', params.radius);
      if (params.polygon) httpParams = httpParams.set('polygon', params.polygon);
    }
    return this.http.get<{ clusters: Cluster[] }>(API_URL + '/', { params: httpParams });
  }

  create(asset: AssetCreate): Observable<Asset> {
    return this.http.post<Asset>(API_URL + '/', asset);
  }
}

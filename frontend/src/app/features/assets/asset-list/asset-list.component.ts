import { AfterViewInit, Component, DestroyRef, ElementRef, inject, NgZone, ViewChild } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { InputNumberModule } from 'primeng/inputnumber';
import { PanelModule } from 'primeng/panel';
import { MessageService } from 'primeng/api';
import { AssetService } from '../../../core/services/asset.service';
import { Asset, Cluster, CATEGORIES, STATUSES, AssetListParams } from '../../../models/asset.model';
import type { Map, Marker, LatLng, Layer, Circle } from 'leaflet';

const AUTO_CLUSTER_THRESHOLD = 50;

@Component({
  selector: 'app-asset-list',
  standalone: true,
  imports: [
    DecimalPipe,
    FormsModule,
    ButtonModule,
    SelectModule,
    InputNumberModule,
    PanelModule,
  ],
  templateUrl: './asset-list.component.html',
  styleUrl: './asset-list.component.css',
})
export class AssetListComponent implements AfterViewInit {
  @ViewChild('mapRef') mapRef!: ElementRef<HTMLDivElement>;

  private assetService = inject(AssetService);
  private destroyRef = inject(DestroyRef);
  private router = inject(Router);
  private messageService = inject(MessageService);
  private ngZone = inject(NgZone);

  constructor() {
    const state = this.router.getCurrentNavigation()?.extras?.state as { createError?: string } | undefined;
    if (state?.createError) {
      const createError = state.createError;
      setTimeout(() => {
        this.ngZone.run(() => {
          this.messageService.add({
            severity: 'error',
            summary: 'Création impossible',
            detail: createError,
          });
        });
      }, 0);
    }
  }

  assets: Asset[] = [];
  clusters: Cluster[] = [];
  loading = false;
  selectedLat: number | null = null;
  selectedLon: number | null = null;

  private map: Map | null = null;
  private markers: Marker[] = [];
  private selectionMarker: Marker | null = null;
  private radiusCircle: Circle | null = null;
  categoryOptions = CATEGORIES;
  statusOptions = STATUSES;

  filterCategory: string | null = null;
  filterRadius: number | null = null;
  polygonWkt: string | null = null;

  private drawnLayers: unknown = null;
  private drawControl: unknown = null;

  ngAfterViewInit(): void {
    if (typeof window !== 'undefined' && this.mapRef?.nativeElement) {
      this.initMap();
      this.load();
    }
  }

  private async initMap(): Promise<void> {
    const L = await import('leaflet');
    await import('leaflet-draw');
    this.map = L.map(this.mapRef.nativeElement).setView([48.8566, 2.3522], 10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
    }).addTo(this.map);
    const drawnItems = new L.FeatureGroup();
    this.map.addLayer(drawnItems);
    this.drawnLayers = drawnItems;
    const selectionPane = this.map.createPane('selectionPin');
    if (selectionPane) {
      (selectionPane as HTMLElement).style.zIndex = '1000';
    }
    this.map.on('draw:created', (e: { layer: Layer & { getLatLngs: () => LatLng[] | LatLng[][] } }) => {
      this.ngZone.run(() => {
        drawnItems.clearLayers();
        drawnItems.addLayer(e.layer);
        const latlngs = e.layer.getLatLngs();
        const ring = (Array.isArray(latlngs[0]) ? latlngs[0] : latlngs) as LatLng[];
        this.polygonWkt = this.latLngsToWkt(ring);
        this.load();
      });
    });
    const Ld = L as unknown as { Control: { Draw: new (o: object) => L.Control } };
    const drawControl = new Ld.Control.Draw({
      draw: {
        polygon: { shapeOptions: {}, repeatMode: false },
        polyline: false,
        circle: false,
        rectangle: false,
        marker: false,
        circlemarker: false,
      },
      edit: { featureGroup: drawnItems },
    });
    this.map.addControl(drawControl);
    this.drawControl = drawControl;
    this.map.on('click', (e: { latlng: { lat: number; lng: number } }) => {
      const lat = e.latlng.lat;
      const lon = e.latlng.lng;
      if (this.selectionMarker) {
        this.selectionMarker.remove();
        this.selectionMarker = null;
      }
      const redIcon = L.divIcon({
        className: 'selection-pin',
        html: '<div class="selection-pin-inner"></div>',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });
      const marker = L.marker([lat, lon], { icon: redIcon, pane: 'selectionPin' });
      marker.addTo(this.map!);
      this.selectionMarker = marker;
      this.ngZone.run(() => {
        this.selectedLat = lat;
        this.selectedLon = lon;
      });
    });
    this.updateMapContent();
  }

  goToNewAsset(): void {
    if (this.selectedLat != null && this.selectedLon != null) {
      this.router.navigate(['/assets/new'], {
        state: { latitude: this.selectedLat, longitude: this.selectedLon },
      });
    } else {
      this.router.navigate(['/assets/new']);
    }
  }

  clearSelection(): void {
    if (this.selectionMarker) {
      this.selectionMarker.remove();
      this.selectionMarker = null;
    }
    this.removeRadiusCircle();
    this.selectedLat = null;
    this.selectedLon = null;
  }

  private async updateRadiusCircle(): Promise<void> {
    if (!this.map) return;
    this.removeRadiusCircle();
    const lat = this.selectedLat;
    const lon = this.selectedLon;
    const radius = this.filterRadius;
    if (lat == null || lon == null || radius == null || radius <= 0) return;
    const L = await import('leaflet');
    this.radiusCircle = L.circle([lat, lon], {
      radius,
      color: '#c00',
      fillColor: '#c00',
      fillOpacity: 0.15,
      weight: 2,
    }).addTo(this.map);
  }

  private removeRadiusCircle(): void {
    if (this.radiusCircle) {
      this.radiusCircle.remove();
      this.radiusCircle = null;
    }
  }

  private latLngsToWkt(ring: LatLng[]): string {
    const points = ring.map((ll) => `${ll.lng} ${ll.lat}`);
    if (points.length > 0 && (ring[0].lat !== ring[ring.length - 1].lat || ring[0].lng !== ring[ring.length - 1].lng)) {
      points.push(`${ring[0].lng} ${ring[0].lat}`);
    }
    return `POLYGON((${points.join(', ')}))`;
  }

  load(): void {
    this.loading = true;
    const params: AssetListParams = {
      category: this.filterCategory ?? undefined,
      lat: this.selectedLat ?? undefined,
      lon: this.selectedLon ?? undefined,
      radius: this.filterRadius ?? undefined,
      polygon: this.polygonWkt ?? undefined,
    };
    this.assetService
      .getList(params)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => {
          const apply = () => {
            if (list.length > AUTO_CLUSTER_THRESHOLD) {
              this.assetService
                .getClusters(params)
                .pipe(takeUntilDestroyed(this.destroyRef))
                .subscribe({
                  next: (res) => {
                    setTimeout(() => {
                      this.clusters = res.clusters;
                      this.assets = [];
                      this.loading = false;
                      this.updateMapContent();
                    }, 0);
                  },
                  error: () => {
                    setTimeout(() => {
                      this.assets = list;
                      this.clusters = [];
                      this.loading = false;
                      this.updateMapContent();
                    }, 0);
                  },
                });
            } else {
              setTimeout(() => {
                this.assets = list;
                this.clusters = [];
                this.loading = false;
                this.updateMapContent();
              }, 0);
            }
          };
          setTimeout(apply, 0);
        },
        error: () => {
          setTimeout(() => {
            this.loading = false;
            this.updateMapContent();
          }, 0);
        },
      });
  }

  private async updateMapContent(): Promise<void> {
    if (!this.map) return;
    const L = await import('leaflet');
    this.markers.forEach((m) => m.remove());
    this.markers = [];
    const clusterIcon = L.divIcon({
      className: 'marker-pin-cluster',
      html: '<div class="marker-pin-inner"></div>',
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });
    const assetIcon = L.divIcon({
      className: 'marker-pin-asset',
      html: '<div class="marker-pin-inner"></div>',
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });
    if (this.clusters.length > 0) {
      for (const c of this.clusters) {
        const isSingleAsset = c.count === 1 && c.asset;
        const popupContent = isSingleAsset
          ? `<strong>${c.asset!.name}</strong><br/>${c.asset!.category}<br/>Lat: ${c.asset!.latitude}<br/>Lon: ${c.asset!.longitude}`
          : `Cluster: ${c.count} actif(s)`;
        const m = L.marker([c.lat, c.lon], { icon: isSingleAsset ? assetIcon : clusterIcon })
          .addTo(this.map)
          .bindPopup(popupContent);
        this.markers.push(m);
      }
    } else {
      for (const a of this.assets) {
        const m = L.marker([a.latitude, a.longitude], { icon: assetIcon })
          .addTo(this.map)
          .bindPopup(
            `<strong>${a.name}</strong><br/>${a.category}<br/>Lat: ${a.latitude}<br/>Lon: ${a.longitude}`
          );
        this.markers.push(m);
      }
    }
  }

  applyFilters(): void {
    this.updateRadiusCircle();
    this.load();
  }

  clearPolygon(): void {
    this.polygonWkt = null;
    if (this.drawnLayers && typeof (this.drawnLayers as { clearLayers: () => void }).clearLayers === 'function') {
      (this.drawnLayers as { clearLayers: () => void }).clearLayers();
    }
    this.load();
  }
}

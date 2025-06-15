import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, AfterViewInit, ElementRef, ViewChild, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import 'leaflet-control-geocoder';
import { LocationData, LocationPickerOptions } from '../models/location.model';

// Fix for default marker icons in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'marker-icon-2x.png',
  iconUrl: 'marker-icon.png',
  shadowUrl: 'marker-shadow.png',
});

@Component({
  selector: 'app-location-picker',
  imports: [CommonModule],
  templateUrl: './location-picker.component.html',
  styleUrl: './location-picker.component.css',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => LocationPickerComponent),
      multi: true
    }
  ]
})
export class LocationPickerComponent implements OnInit, AfterViewInit, OnDestroy, ControlValueAccessor {
  @Input() options: LocationPickerOptions = {};
  @Output() locationChange = new EventEmitter<LocationData>();
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;

  // Current location and marker
  private _location: LocationData | null = null;
  private map: L.Map | null = null;
  private marker: L.Marker | null = null;

  // ControlValueAccessor implementation
  private onChange = (location: LocationData | null) => {};
  private onTouched = () => {};
  disabled = false;

  ngOnInit(): void {
    // Initial setup happens in ngAfterViewInit
  }

  ngAfterViewInit(): void {
    // Use setTimeout to defer initial location setting until after change detection
    setTimeout(() => {
      this.initializeMap();
    }, 0);
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
    }
  }

  private initializeMap(): void {
    // Default location (London)
    const defaultLat = this.options.defaultLocation?.latitude || 51.505;
    const defaultLng = this.options.defaultLocation?.longitude || -0.09;
    const defaultZoom = this.options.zoom || 13;

    // Initialize map
    this.map = L.map(this.mapContainer.nativeElement).setView(
      [defaultLat, defaultLng], 
      defaultZoom
    );

    // Define base layers - all free providers
    const osmStandard = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    });

    const osmHot = L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors, Tiles style by Humanitarian OpenStreetMap Team'
    });

    const openTopoMap = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      maxZoom: 17,
      attribution: '© OpenStreetMap contributors, © OpenTopoMap'
    });

    const esriWorldImagery = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: '© Esri, DigitalGlobe, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN, and the GIS User Community'
    });

    const esriWorldTopoMap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: '© Esri, HERE, Garmin, © OpenStreetMap contributors, and the GIS User Community'
    });

    const cartoDBPositron = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors © CARTO'
    });

    const cartoDBDarkMatter = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors © CARTO'
    });

    const stamenTerrain = L.tileLayer('https://stamen-tiles-{s}.a.ssl.fastly.net/terrain/{z}/{x}/{y}{r}.png', {
      maxZoom: 18,
      attribution: '© Stamen Design, © OpenStreetMap contributors'
    });

    // Set default layer
    osmStandard.addTo(this.map);

    // Create base layers object for layer control
    const baseLayers = {
      "OpenStreetMap": osmStandard,
      "OSM Humanitarian": osmHot,
      "OpenTopoMap": openTopoMap,
      "Satellite (Esri)": esriWorldImagery,
      "Esri WorldTopoMap": esriWorldTopoMap,
      "CartoDB Positron": cartoDBPositron,
      "CartoDB Dark": cartoDBDarkMatter,
      "Stamen Terrain": stamenTerrain
    };

    // Add layer control to the map
    L.control.layers(baseLayers, {}, {
      position: 'topright',
      collapsed: true
    }).addTo(this.map);

    // Add geocoder search control (if not disabled)
    if (!this.disabled) {
      const geocoder = (L.Control as any).geocoder({
        defaultMarkGeocode: false,
        placeholder: 'Search for a location or enter coordinates...',
        errorMessage: 'No location found',
        showResultIcons: true,
        suggestMinLength: 3,
        suggestTimeout: 250,
        queryMinLength: 1
      }).on('markgeocode', (e: any) => {
        // Handle geocoder result selection
        const latlng = e.geocode.center;
        this.setLocation({
          latitude: latlng.lat,
          longitude: latlng.lng
        });
      }).addTo(this.map);
    }

    // Add click handler for map
    if (!this.disabled) {
      this.map.on('click', (e: L.LeafletMouseEvent) => {
        this.setLocation({
          latitude: e.latlng.lat,
          longitude: e.latlng.lng
        });
      });
    }

    // Set initial location if provided
    if (this._location) {
      this.updateMapView();
    } else if (this.options.defaultLocation) {
      this.setLocation(this.options.defaultLocation);
    }
  }

  private setLocation(location: LocationData): void {
    this._location = location;
    this.updateMapView();
    this.locationChange.emit(location);
    this.onChange(location);
    this.onTouched();
  }

  private updateMapView(): void {
    if (!this.map || !this._location) return;

    const latLng = L.latLng(this._location.latitude, this._location.longitude);

    // Remove existing marker
    if (this.marker) {
      this.map.removeLayer(this.marker);
    }

    // Add new marker
    this.marker = L.marker(latLng, {
      draggable: !this.disabled
    }).addTo(this.map);

    // Handle marker drag
    if (!this.disabled) {
      this.marker.on('dragend', () => {
        if (this.marker) {
          const position = this.marker.getLatLng();
          this.setLocation({
            latitude: position.lat,
            longitude: position.lng
          });
        }
      });
    }

    // Center map on location
    this.map.setView(latLng, this._location.zoom || this.options.zoom || 13);
  }

  clearLocation(): void {
    if (this.marker && this.map) {
      this.map.removeLayer(this.marker);
      this.marker = null;
    }
    this._location = null;
    this.locationChange.emit(null as any);
    this.onChange(null);
    this.onTouched();
  }

  get location(): LocationData | null {
    return this._location;
  }

  get hasLocation(): boolean {
    return this._location !== null;
  }

  get locationDisplay(): string {
    if (!this._location) return 'No location selected';
    return `${this._location.latitude.toFixed(6)}, ${this._location.longitude.toFixed(6)}`;
  }

  // ControlValueAccessor methods
  writeValue(location: LocationData | null): void {
    if (location) {
      this.setLocation(location);
    } else {
      this.clearLocation();
    }
  }

  registerOnChange(fn: (location: LocationData | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    if (this.marker) {
      this.marker.dragging?.disable();
      if (!isDisabled) {
        this.marker.dragging?.enable();
      }
    }
  }
}

export interface LocationData {
  latitude: number;
  longitude: number;
  zoom?: number;
}

export interface LocationPickerOptions {
  defaultLocation?: LocationData;
  zoom?: number;
  height?: string;
  width?: string;
  disabled?: boolean;
}
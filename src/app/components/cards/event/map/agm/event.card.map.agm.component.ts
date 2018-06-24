import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  HostListener,
  Input,
  OnChanges,
  OnInit, SimpleChange,
  ViewChild,
} from '@angular/core';
import {AgmMap, LatLngBoundsLiteral, PolyMouseEvent} from '@agm/core';
import {AppEventColorService} from '../../../../../services/color/app.event.color.service';
import {GoogleMapsAPIWrapper} from '@agm/core/services/google-maps-api-wrapper';
import {EventInterface} from 'quantified-self-lib/lib/events/event.interface';
import {ActivityInterface} from 'quantified-self-lib/lib/activities/activity.interface';
import {PointInterface} from 'quantified-self-lib/lib/points/point.interface';
import {LapInterface} from 'quantified-self-lib/lib/laps/lap.interface';
import {DataPositionInterface} from 'quantified-self-lib/lib/data/data.position.interface';
import {ControlPosition, MapTypeControlOptions} from '@agm/core/services/google-maps-types';
import {GeoLibAdapter} from 'quantified-self-lib/lib/geodesy/adapters/geolib.adapter';
import {DataNumberOfSatellites} from 'quantified-self-lib/lib/data/data.number-of-satellites';
import {Log} from 'ng2-logger/client';
import {LapTypes} from 'quantified-self-lib/lib/laps/lap.types';

@Component({
  selector: 'app-event-card-map-agm',
  templateUrl: './event.card.map.agm.component.html',
  styleUrls: ['./event.card.map.agm.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})

export class EventCardMapAGMComponent implements OnChanges, OnInit {
  @ViewChild(AgmMap) agmMap;
  @Input() event: EventInterface;
  @Input() selectedActivities: ActivityInterface[];
  @Input() isVisible: boolean;
  @Input() showAutoLaps = true;
  @Input() showManualLaps = false;
  @Input() showData = false;
  @Input() showDataWarnings = false;


  public mapData: MapData[] = [];
  public openedLapMarkerInfoWindow: LapInterface;
  public openedActivityStartMarkerInfoWindow: ActivityInterface;
  public clickedPoint: PointInterface;
  public mapTypeControlOptions: MapTypeControlOptions = {
    // mapTypeIds: [MapTypeId.TERRAIN],
    position: ControlPosition.TOP_RIGHT,
  };

  private logger = Log.create('EventCardMapAGMComponent');

  constructor(
    private changeDetectorRef: ChangeDetectorRef,
    public eventColorService: AppEventColorService) {
  }

  ngOnInit() {
  }

  ngOnChanges(simpleChanges) {
    if (simpleChanges.event
      || simpleChanges.selectedActivities
      || simpleChanges.showAutoLaps
      || simpleChanges.showManualLaps
      || simpleChanges.showData
      || simpleChanges.showDataWarnings) {
      this.mapData = this.cacheNewData();
    }

    if (this.isVisible) {
      this.agmMap.triggerResize().then(() => {
        const googleMaps: GoogleMapsAPIWrapper = this.agmMap._mapsWrapper;
        googleMaps.fitBounds(this.getBounds());
      });
    }
  }

  private cacheNewData(): MapData[] {
    const t0 = performance.now();
    const mapData = [];
    this.selectedActivities.forEach((activity) => {
      let activityPoints: PointInterface[];
      if (this.showData){
        activityPoints = activity.getPointsInterpolated();
      }else {
        activityPoints = activity.getPoints()
      }
      activityPoints = activityPoints.filter((point) => point.getPosition());
      let lowNumberOfSatellitesPoints: PointInterface[] = [];
      if (this.showDataWarnings) {
        lowNumberOfSatellitesPoints = activityPoints.filter((point) => {
          const numberOfSatellitesData = point.getDataByType(DataNumberOfSatellites.type);
          if (!numberOfSatellitesData) {
            return false
          }
          return numberOfSatellitesData.getValue() < 7;
        });
      }
      // If the activity has no points skip
      if (!activityPoints.length) {
        return;
      }
      // Check for laps with position
      const lapsWithPosition = activity.getLaps()
        .filter((lap) => {
          if (!this.showAutoLaps && lap.type === LapTypes.AutoLap) {
            return false;
          }
          if (!this.showManualLaps && lap.type === LapTypes.Manual) {
            return false;
          }
          return true;
        })
        .reduce((lapsArray, lap) => {
          const lapPoints = this.event.getPointsWithPosition(lap.startDate, lap.endDate, [activity]);
          if (lapPoints.length) {
            lapsArray.push({
              lap: lap,
              lapPoints: lapPoints,
              lapEndPoint: lapPoints[lapPoints.length - 1],
            })
          }
          return lapsArray;
        }, []);
      // Create the object
      mapData.push({
        activity: activity,
        points: activityPoints,
        lowNumberOfSatellitesPoints: lowNumberOfSatellitesPoints,
        activityStartPoint: activityPoints[0],
        lapsWithPosition: lapsWithPosition,
      });
    });
    const t1 = performance.now();
    this.logger.d(`Parsed data after ${t1 - t0}ms`);
    return mapData;
  }

  getBounds(): LatLngBoundsLiteral {
    const pointsWithPosition = this.mapData.reduce((pointsArray, activityData) => pointsArray.concat(activityData.points), []);
    if (!pointsWithPosition.length) {
      return <LatLngBoundsLiteral>{
        east: 0,
        west: 0,
        north: 0,
        south: 0,
      };
    }
    const mostEast = pointsWithPosition.reduce((acc: PointInterface, point: PointInterface) => {
      const pointPosition = <DataPositionInterface>point.getPosition();
      const accPosition = <DataPositionInterface>acc.getPosition();
      return (accPosition.longitudeDegrees < pointPosition.longitudeDegrees) ? point : acc;
    });
    const mostWest = pointsWithPosition.reduce((acc: any, point: PointInterface) => {
      const pointPosition = <DataPositionInterface>point.getPosition();
      const accPosition = <DataPositionInterface>acc.getPosition();

      return (accPosition.longitudeDegrees > pointPosition.longitudeDegrees) ? point : acc;
    });
    const mostNorth = pointsWithPosition.reduce((acc: any, point: PointInterface) => {
      const pointPosition = <DataPositionInterface>point.getPosition();
      const accPosition = <DataPositionInterface>acc.getPosition();
      return (accPosition.latitudeDegrees < pointPosition.latitudeDegrees) ? point : acc;
    });
    const mostSouth = pointsWithPosition.reduce((acc: any, point: PointInterface) => {
      const pointPosition = <DataPositionInterface>point.getPosition();
      const accPosition = <DataPositionInterface>acc.getPosition();
      return (accPosition.latitudeDegrees > pointPosition.latitudeDegrees) ? point : acc;
    });
    return <LatLngBoundsLiteral>{
      east: mostEast.getPosition().longitudeDegrees,
      west: mostWest.getPosition().longitudeDegrees,
      north: mostNorth.getPosition().latitudeDegrees,
      south: mostSouth.getPosition().latitudeDegrees,
    };
  }

  openLapMarkerInfoWindow(lap) {
    this.openedLapMarkerInfoWindow = lap;
    this.openedActivityStartMarkerInfoWindow = void 0;
  }

  openActivityStartMarkerInfoWindow(activity) {
    this.openedActivityStartMarkerInfoWindow = activity;
    this.openedLapMarkerInfoWindow = void 0;
  }

  lineClick(event: PolyMouseEvent, points: PointInterface[]) {
    const nearestPoint = (new GeoLibAdapter()).getNearestPointToPosition({
      latitudeDegrees: event.latLng.lat(),
      longitudeDegrees: event.latLng.lng(),
    }, points);
    if (nearestPoint) {
      this.clickedPoint = nearestPoint;
    }
  }

  getMapValuesAsArray<K, V>(map: Map<K, V>): V[] {
    return Array.from(map.values());
  }

  @HostListener('window:resize', ['$event.target.innerWidth'])
  onResize(width) {
    this.agmMap.triggerResize().then(() => {
      this.agmMap._mapsWrapper.fitBounds(this.getBounds())
    });
  }
}

export interface MapData {
  activity: ActivityInterface,
  points: PointInterface[],
  lowNumberOfSatellitesPoints: PointInterface[],
  activityStartPoint: PointInterface,
  lapsWithPosition: {
    lap: LapInterface,
    lapPoints: PointInterface[],
    lapEndPoint: PointInterface
  }[]
}

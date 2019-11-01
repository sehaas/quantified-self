import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  NgZone,
  OnChanges,
  OnDestroy,
  OnInit,
} from '@angular/core';
import {Log} from 'ng2-logger/browser'
import * as am4core from '@amcharts/amcharts4/core';
import * as am4charts from '@amcharts/amcharts4/charts';
import {DynamicDataLoader} from 'quantified-self-lib/lib/data/data.store';
import * as Sentry from '@sentry/browser';
import {
  ChartDataCategoryTypes,
  ChartDataValueTypes
} from 'quantified-self-lib/lib/users/user.dashboard.chart.settings.interface';
import * as am4plugins_sliceGrouper from '@amcharts/amcharts4/plugins/sliceGrouper';
import {DashboardChartAbstract} from '../dashboard-chart.abstract';
import {SummariesChartDataInterface} from '../../summaries/summaries.component';


@Component({
  selector: 'app-pie-chart',
  templateUrl: './charts.pie.component.html',
  styleUrls: ['./charts.pie.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChartsPieComponent extends DashboardChartAbstract implements OnChanges, OnInit, OnDestroy, AfterViewInit {

  protected logger = Log.create('ChartPieComponent');

  constructor(protected zone: NgZone, changeDetector: ChangeDetectorRef) {
    super(zone, changeDetector);
  }

  async ngAfterViewInit() {
  }

  async ngOnInit() {
  }

  protected createChart(): am4charts.PieChart {
    const chart = <am4charts.PieChart>super.createChart(am4charts.PieChart);

    // chart.hiddenState.properties.opacity = 0;
    // chart.padding(0, 0, 0, 0)
    chart.radius = am4core.percent(50);
    chart.innerRadius = am4core.percent(35);

    const pieSeries = chart.series.push(new am4charts.PieSeries());
    pieSeries.dataFields.value = 'value';
    pieSeries.dataFields.category =  this.chartDataCategoryType === ChartDataCategoryTypes.ActivityType ? 'type' : 'time';
    // pieSeries.interpolationDuration = 500;
    // pieSeries.rangeChangeDuration = 500;
    // pieSeries.sequencedInterpolation = true;

    pieSeries.slices.template.propertyFields.isActive = 'pulled';
    pieSeries.slices.template.strokeWidth = 0.4;
    pieSeries.slices.template.strokeOpacity = 1;
    pieSeries.slices.template.stroke = am4core.color('#175e84');
    pieSeries.slices.template.filters.push(this.getShadowFilter())

    pieSeries.slices.template.adapter.add('tooltipText', (text, target, key) => {
      if (!target.dataItem || !target.dataItem.values || ! target.dataItem.dataContext) {
        return '';
      }
      const data = DynamicDataLoader.getDataInstanceFromDataType(this.chartDataType, target.dataItem.dataContext['value']);
      return `{category${this.chartDataCategoryType === ChartDataCategoryTypes.ActivityType ? ``: `.formatDate('${this.getChartDateFormat(this.chartDataDateRange)}')`}} ${target.dataItem.dataContext['count'] ? `(x${target.dataItem.dataContext['count']})` : ``} - ${target.dataItem.values.value.percent.toFixed(1)}% - [bold]${data.getDisplayValue()}${data.getDisplayUnit()}[/b]`
    });

    pieSeries.slices.template.adapter.add('fill', (fill, target, key) => {
      return this.getFillColor(chart, target.dataItem.index);
    });

    pieSeries.labels.template.adapter.add('text', (text, target, key) => {
      if (!target.dataItem || !target.dataItem.values || !target.dataItem.dataContext) {
        return '';
      }
      try {
        const data = DynamicDataLoader.getDataInstanceFromDataType(this.chartDataType, target.dataItem.dataContext['value']);
        return `[font-size: 1.1em]${this.chartDataCategoryType === ChartDataCategoryTypes.ActivityType ? target.dataItem.dataContext.type.slice(0, 40) : `{category.formatDate('${this.getChartDateFormat(this.chartDataDateRange)}')}` || 'other'}[/] [bold font-size: 1.2em]{value.percent.formatNumber('#.')}%[/]\n[bold]${data.getDisplayValue()}${data.getDisplayUnit()}[/b]`
      } catch (e) {
        Sentry.captureException(e);
      }
    });

    const label = pieSeries.createChild(am4core.Label);
    label.horizontalCenter = 'middle';
    label.verticalCenter = 'middle';
    // label.fontSize = 12;
    if (this.chartDataValueType === ChartDataValueTypes.Total) {
      label.text = `{values.value.sum.formatNumber('#')}`;
    }
    if (this.chartDataValueType === ChartDataValueTypes.Maximum) {
      label.text = `{values.value.high.formatNumber('#')}`;
    }
    if (this.chartDataValueType === ChartDataValueTypes.Minimum) {
      label.text = `{values.value.low.formatNumber('#')}`;
    }
    if (this.chartDataValueType === ChartDataValueTypes.Average) {
      label.text = `{values.value.average.formatNumber('#')}`;
    }
    label.adapter.add('textOutput', (text, target, key) => {
      const data = DynamicDataLoader.getDataInstanceFromDataType(this.chartDataType, Number(text));
      return `[font-size: 1.3em]${data.getDisplayType()}[/]
              [font-size: 1.4em]${data.getDisplayValue()}${data.getDisplayUnit()}[/]
              [font-size: 1.0em]${this.chartDataValueType}[/]`
    });

    // chart.exporting.menu = this.getExportingMenu();

    // Disable the preloader
    chart.preloader.disabled = true;

    if (this.filterLowValues) {
      const grouper = pieSeries.plugins.push(new am4plugins_sliceGrouper.SliceGrouper());
      grouper.threshold = 5;
      grouper.groupName = 'Other';
      grouper.clickBehavior = 'zoom';
      grouper.zoomOutButton.align = 'left';
      grouper.zoomOutButton.width = 35;
      grouper.zoomOutButton.valign = 'top';
    }

    // Attach events
    this.attachEventListenersOnChart(chart);
    return chart;
  }

  /**
   * Noop here for this component
   * @param data
   */
  filterOutLowValues(data: SummariesChartDataInterface[]): SummariesChartDataInterface[] {
    return data;
  }
}

// ES6 modül formatında
import React, { useEffect, useRef } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';

function TesisChartComponent({ tesisData, tesisName, selectedMeasurementType }) {
    const chartRef = useRef(null);

    const colors = [
        am5.color(0xe6194b), // Parlak Kırmızı
        am5.color(0x3cb44b), // Canlı Yeşil
        am5.color(0x4363d8), // Canlı Mavi
        am5.color(0xffe119), // Sarı
        am5.color(0xf58231), // Turuncu
        am5.color(0x911eb4), // Mor
        am5.color(0x46f0f0), // Açık Turkuaz
        am5.color(0xf032e6)  // Pembe-Mor
      ];
      



    useEffect(() => {
        if (!tesisData || !tesisData.data || !chartRef.current) {
            console.log('TesisChartComponent - Gerekli veriler eksik:', { tesisData, chartRef: chartRef.current });
            return;
        }
        
        // amCharts global değişkenlerini kontrol et
        if (typeof am5 === 'undefined') {
            console.error('am5 tanımlı değil!');
            return;
        }
        if (typeof am5xy === 'undefined') {
            console.error('am5xy tanımlı değil!');
            return;
        }

        // Önceki root'u temizle
        if (chartRef.current._am5Root) {
            try {
                chartRef.current._am5Root.dispose();
                console.log('Önceki root temizlendi');
            } catch (error) {
                console.log('Önceki root temizlenirken hata:', error);
            }
        }

        try {
            // Root element oluştur
            const root = am5.Root.new(chartRef.current);
            // Root referansını DOM element'inde sakla
            chartRef.current._am5Root = root;
            root.setThemes([
                am5themes_Animated.new(root)
              ]);
            // Chart oluştur
            const chart = root.container.children.push(
                am5xy.XYChart.new(root, {
                    panX: true,
                    panY: true,
                    wheelX: "zoomX",
                    wheelY: "zoomX",
                    pinchZoomX: true,
                    layout: root.verticalLayout
                })
            );

            // X ekseni (zaman) - Önce tanımla
            const xAxis = chart.xAxes.push(
                am5xy.DateAxis.new(root, {
                    baseInterval: { timeUnit: "second", count: 1 },
                    renderer: am5xy.AxisRendererX.new(root, {
                        minGridDistance: 50
                    }),
                    tooltip: am5.Tooltip.new(root, {}),
                    // Zaman formatını daha detaylı göster
                    dateFormats: {
                        second: "HH:mm:ss",
                        minute: "HH:mm",
                        hour: "HH:mm",
                        day: "MMM dd",
                        week: "MMM dd",
                        month: "MMM yyyy",
                        year: "yyyy"
                    },
                   
                    // Etiketleri daha sık göster
                    labelInterval: { timeUnit: "second", count: 30 }
                })
            );

            // X ekseni etiket yoğunluğunu kontrol et
            const xRenderer = xAxis.get("renderer");

            // Etiketler arası minimum piksel aralığı (yoğunluğu azaltır)
            xRenderer.set("minGridDistance", 80);

            // Küçük alanlarda çakışmayı gizle veya kırp
            xRenderer.labels.template.setAll({
                oversizedBehavior: "hide", // "truncate" da kullanabilirsin
                centerY: am5.p50,
                centerX: am5.p50,
                paddingTop: 6
            });

            // Daha seyrek etiket (30 saniye yerine 1 dakika)
            xAxis.setAll({
                labelInterval: { timeUnit: "minute", count: 1 },
                // çizgi aralıklarını da daha anlamlı ölçeklere sabitle
                gridIntervals: [
                    { timeUnit: "minute", count: 1 },
                    { timeUnit: "minute", count: 5 },
                    { timeUnit: "minute", count: 10 },
                    { timeUnit: "hour", count: 1 }
                ]
            });

            // Y ekseni (değer) - Sonra tanımla
            const yAxis = chart.yAxes.push(
                am5xy.ValueAxis.new(root, {
                    renderer: am5xy.AxisRendererY.new(root, {}),
                    tooltip: am5.Tooltip.new(root, {})
                })
            );

            // Zoom ve pan için cursor - Şimdi eksenler tanımlandıktan sonra
            chart.set("cursor", am5xy.XYCursor.new(root, {
                yAxis: yAxis,
                xAxis: xAxis,
                snapToSeries: [yAxis],
                snapToSeriesBy: "y!",
            }));

            // Legend
                      // Legend oluştur
            const legend = chart.children.push(
                am5.Legend.new(root, {
                    centerX: am5.p50,
                    x: am5.p50,
                    centerY: am5.p100,
                    y: am5.p100,
                    layout: root.horizontalLayout,

                    // Legend'ı chart container içinde tut
                    container: chart.plotContainer,
                    // Responsive ayarlar
                    responsive: {
                        enabled: true
                    }
                })
            );

            // 1) Legend verisini bağla (şart)
            legend.data.setAll(chart.series.values);

            // 2) Tam genişlik + horizontal düzen (otomatik genişlesin)
            legend.setAll({
                width: am5.percent(100),
            });

         
            // Legend marker'larını daha belirgin yap (varsayılan dikdörtgen marker kullan)
            legend.set("useDefaultMarker", true);
            legend.markers.template.setAll({ width: 16, height: 12, marginRight: 6 });
            legend.markerRectangles.template.setAll({
                width: 16,
                height: 12,
                strokeOpacity: 1,
                strokeWidth: 1,
                stroke: am5.color(0x334155),
                cornerRadius: 3,
                
            });

            // 4) Responsive: küçük ekranda da 6 sütun, sadece yazı küçülsün
            function updateLegendLayout() {
                const w = root.dom.clientWidth;
                if (w < 720) {
                    // Mobil: 6 sütun, küçük font
                    legend.setAll({
                        layout: am5.GridLayout.new(root, { maxColumns: 6, fixedWidthGrid: true }),
                        width: am5.percent(100)
                    });
                    legend.labels.template.setAll({
                        fontSize: 8,
                    });
                    legend.markers.template.setAll({ width: 8, height: 8 });
                } else {
                    // Desktop: 6 sütun, normal font
                    legend.setAll({
                        layout: am5.GridLayout.new(root, { maxColumns: 6, fixedWidthGrid: true }),
                        width: am5.percent(100)
                    });
                    legend.labels.template.setAll({
                        fontSize: 10,
                    });
                    legend.markers.template.setAll({ width: 10, height: 10 });
                }
            }

            // X ekseni yoğunluğunu genişliğe göre dinamikleştir
            function updateXAxisDensity() {
                const w = root.dom.clientWidth;
                if (w < 720) {
                    xAxis.set("labelInterval", { timeUnit: "minute", count: 1 });
                    xAxis.get("renderer").set("minGridDistance", 90);
                } else {
                    xAxis.set("labelInterval", { timeUnit: "minute", count: 1 }); // istersen desktop'ta 30s yap
                    xAxis.get("renderer").set("minGridDistance", 80);
                }
            }

            updateLegendLayout();
            updateXAxisDensity();
            root.events.on("frameended", () => {
                updateLegendLayout();
                updateXAxisDensity();
            });

            // Her inverter/RTU için seri oluştur
            Object.keys(tesisData.data).forEach((itemNum, index) => {
                const itemData = tesisData.data[itemNum];
                
                if (itemData && itemData.length > 0) {
                    // Seçili ölçüm tipini bul
                    let selectedMeasurement;
                    if (tesisData.searchType === 'rtu-measp') {
                        // RTU verileri için sadece ilk ölçümü al (tek çizgi)
                        selectedMeasurement = itemData[0];
                    } else {
                        // Inverter verileri için ölçüm tipine göre filtrele
                        selectedMeasurement = itemData.find(m => {
                            const normalizedType = m.measurementType?.replace('_SQL', '').replace('_SQ', '');
                            return normalizedType === selectedMeasurementType;
                        });
                    }
                    
                    if (selectedMeasurement && selectedMeasurement.history) {
 
                        // Veriyi hazırla
                        const chartData = selectedMeasurement.history.map(item => {
                            let parsedDate;
                            if (typeof item.date === 'string') {
                                // SQL Server string formatından parse et
                                parsedDate = new Date(item.date);
                            } else if (item.date instanceof Date) {
                                parsedDate = item.date;
                            } else {
                                // Diğer formatlar için
                                parsedDate = new Date(item.date);
                            }
                            
                            // Tarih geçerli mi kontrol et
                            if (isNaN(parsedDate.getTime())) {
                                console.error('Invalid date:', item.date);
                                parsedDate = new Date();
                            }
                            
                            return {
                                date: parsedDate.getTime(),
                                value: parseFloat(item.wert) || 0
                            };
                        }).reverse();

                        if (chartData.length > 0) {
                            // Line series oluştur
                            const series = chart.series.push(
                                am5xy.LineSeries.new(root, {
                                    name: tesisData.searchType === 'rtu-measp' ? 
                                        (itemNum.includes('_') ? itemNum.replace('_', ' - RTU ') : `RTU ${itemNum}`) : 
                                        `Inverter ${itemNum}`,
                                    xAxis: xAxis,
                                    yAxis: yAxis,
                                    valueYField: "value",
                                    valueXField: "date",
                                    tooltip: am5.Tooltip.new(root, {
                                        fontSize: 11,
                                        pointerOrientation: "horizontal",
                                        background: am5.Rectangle.new(root, {
                                            fill: am5.color(0x000000),
                                            fillOpacity: 0.9,
                                            stroke: am5.color(0xffffff),
                                            strokeWidth: 1,
                                            cornerRadius: 4
                                        }),
                                        labelText: "{name}: {valueY}",
                                        labelTextColor: am5.color(0xffffff)
                                    })
                                })
                            );

                            // Renkleri zorla uygula
                            const selectedColor = colors[index % colors.length];
   
                            // Tüm renk özelliklerini zorla ayarla
                            series.strokes.template.setAll({
                                stroke: selectedColor,
                                strokeWidth: 2
                            });
                            
                            series.fills.template.setAll({
                                fill: selectedColor
                            });
                            
                            // Ek olarak seri seviyesinde de ayarla
                            series.set("stroke", selectedColor);
                            series.set("fill", selectedColor);

                            // Veriyi set et
                            series.data.setAll(chartData);

                            // Legend'a ekle
                            legend.data.push(series);
                        }
                    }
                }
            });

            // Chart'ı responsive yap
            chart.set("responsive", {
                enabled: true
            });

        } catch (error) {
            console.error('Chart oluşturma hatası:', error);
        }

        // Cleanup
        return () => {
            try {
                // Event listener'ı temizle
                if (root && root.events) {
                    root.events.off("frameended", updateLegendLayout);
                }
                
                if (chartRef.current && chartRef.current._am5Root) {
                    const rootToDispose = chartRef.current._am5Root;
                    if (!rootToDispose.isDisposed()) {
                        rootToDispose.dispose();
                        console.log('Cleanup: Root dispose edildi');
                    }
                    // Referansı temizle
                    chartRef.current._am5Root = null;
                }
            } catch (error) {
                console.error('Cleanup hatası:', error);
            }
        };

    }, [tesisData, tesisName, selectedMeasurementType]);

                if (!tesisData || !tesisData.data || Object.keys(tesisData.data).length === 0) {
                return React.createElement('div', { 
                    className: 'empty-state'
                }, 'Grafik verisi bulunamadı');
            }

                return React.createElement('div', { 
                ref: chartRef,
                className: 'chart-container'
            });
}

export default TesisChartComponent; 
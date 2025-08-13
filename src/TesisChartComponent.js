const React = require('react');
const am5 = require('@amcharts/amcharts5');
const am5xy = require('@amcharts/amcharts5/xy');

function TesisChartComponent({ tesisData, tesisName, selectedMeasurementType }) {
    const chartRef = React.useRef(null);

    React.useEffect(() => {
        if (!tesisData || !tesisData.data || !chartRef.current) return;

        // Root element oluştur
        const root = am5.Root.new(chartRef.current);

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

        // Zoom ve pan için cursor
        chart.set("cursor", am5xy.XYCursor.new(root, {
            behavior: "zoomX",
            xAxis: xAxis,
            yAxis: yAxis
        }));

        // X ekseni (zaman)
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

        // Y ekseni (değer)
        const yAxis = chart.yAxes.push(
            am5xy.ValueAxis.new(root, {
                renderer: am5xy.AxisRendererY.new(root, {}),
                tooltip: am5.Tooltip.new(root, {})
            })
        );

        // Legend
        const legend = chart.children.push(
            am5.Legend.new(root, {
                centerX: am5.p50,
                x: am5.p50,
                centerY: am5.p100,
                y: am5.p100,
                layout: root.horizontalLayout
            })
        );

        const colors = [
            am5.color(0xa7ca1c), // yeşil
            am5.color(0x701010), // koyu kırmızı
            am5.color(0xb967ff), // mor
            am5.color(0xff71ce), // pembe
            am5.color(0x9da77e), // gri-yeşil
            am5.color(0x2d3987), // koyu mavi
            am5.color(0xd1d2ad), // açık gri-bej
            am5.color(0xff007f), // fuşya
            am5.color(0x0074d9), // parlak mavi
            am5.color(0xff851b), // turuncu
            am5.color(0x2ecc40), // canlı yeşil
            am5.color(0xffdc00), // parlak sarı
            am5.color(0x39cccc), // turkuaz
            am5.color(0x85144b), // bordo
            am5.color(0x3d9970), // yeşilimsi camgöbeği
            am5.color(0xb10dc9), // canlı mor
            am5.color(0x111111), // siyah
            am5.color(0x7fdbff), // açık mavi
            am5.color(0xf012be), // parlak pembe-mor
        ];
        
        
        // Debug: Renkleri console'da göster
        console.log('Bizim tanımladığımız renkler:', colors);
        console.log('Renk hex kodları:', colors.map(c => c.toCSS()));
        

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
                                name: tesisData.searchType === 'rtu-measp' ? `RTU ${itemNum}` : `Inverter ${itemNum}`,
                                xAxis: xAxis,
                                yAxis: yAxis,
                                valueYField: "value",
                                valueXField: "date",
                                tooltip: am5.Tooltip.new(root, {
                                    fontSize: 4,
                                    pointerOrientation: "horizontal",
                                    labelText: "[bold]{name}[/]\nDeğer: {valueY}\nZaman: {valueX.formatDate('HH:mm:ss')}"
                                })
                            })
                        );

                        // Çizgi kalınlığını ayarla
                        series.strokes.template.set("strokeWidth", 8);

                        // Veriyi set et
                        series.data.setAll(chartData);

                        // Renk ata
                        const selectedColor = colors[index % colors.length];
                        series.strokes.template.set("stroke", selectedColor);
                        console.log(`Seri ${index}: Renk ${selectedColor.toCSS()} atandı`);
                        console.log(`Seri ${index}: Renk objesi:`, selectedColor);

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

        // Cleanup
        return () => {
            root.dispose();
        };

    }, [tesisData, tesisName, selectedMeasurementType]);

    if (!tesisData || !tesisData.data || Object.keys(tesisData.data).length === 0) {
        return React.createElement('div', { 
            style: { 
                padding: '20px', 
                textAlign: 'center', 
                color: '#666',
                background: '#f8f9fa',
                borderRadius: '8px',
                height: '300px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid #e1e5e9'
            } 
        }, 'Grafik verisi bulunamadı');
    }

    return React.createElement('div', { 
        ref: chartRef,
        style: { 
            width: '100%', 
            height: '300px',
            background: 'white',
            borderRadius: '8px',
            border: '1px solid #e1e5e9'
        } 
    });
}

module.exports = TesisChartComponent; 
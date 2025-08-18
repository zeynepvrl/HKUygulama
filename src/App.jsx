// ES6 modül formatında
import React, { useState, useEffect } from 'react';
import TesisChartComponent from './TesisChartComponent.jsx';

function App() {
    const [isLoading, setIsLoading] = useState(false);
    const [results, setResults] = useState([]);
    const [errors, setErrors] = useState([]);
    const [lastUpdate, setLastUpdate] = useState(null);
    const [selectedMeasurementType, setSelectedMeasurementType] = useState('Active_Power');
    const [searchType, setSearchType] = useState('inverters');

    const targetGES = {
        'Kırşehir': ['Espeges2', 'Ferges5', 'Somges5', 'Verdeges5'], 
        'Niğde': ['Ferges2', 'Somges2', 'Verdeges2'], 
        'Konya - Cihanbeyli': ['Verdeenerji', 'Somenerji', 'Ferenerji', 'Eforenerji'], 
        'Konya - Kulu': ['Fer1', 'Fer2', 'Verde', 'Som','Efor1', 'Efor2']
    };

    // Tesis limit değerleri
    const facilityLimits = {
        // Kırşehir - hepsi 999.6
        'Espeges2': 999.6,
        'Ferges5': 999.6,
        'Somges5': 999.6,
        'Verdeges5': 999.6,
        // Niğde - hepsi 990
        'Ferges2': 990,
        'Somges2': 990,
        'Verdeges2': 990,
        // Konya - Cihanbeyli
        'Eforenerji': 1000,
        'Ferenerji': 1000,
        'Somenerji': 1000,
        'Verdeenerji': 986,
        // Konya - Kulu
        'Efor1': 1000,
        'Efor2': 1000,
        'Fer1': 960,
        'Fer2': 960,
        'Som': 960,
        'Verde': 960
    }; 

    useEffect(() => {

        handleSearch();
        
        // Periyodik çalışma
        const interval = setInterval(() => {
            console.log('⏰ Periyodik veri güncelleme başlatılıyor');
            handleSearch();
        }, 60000);
        
        return () => {
            console.log('🧹 useEffect cleanup - interval temizleniyor');
            clearInterval(interval);
        };
    }, []);

        const handleSearch = async () => {
        setIsLoading(true);

        try {
            const allTables = Object.values(targetGES).flat();
            
            // Electron API'nin mevcut olup olmadığını kontrol et
            if (!window.electronAPI) {
                console.error('❌ window.electronAPI tanımlı değil!');
                throw new Error('Electron API bulunamadı');
            }
            
            if (!window.electronAPI.searchInverters) {
                console.error('❌ searchInverters fonksiyonu bulunamadı!');
                throw new Error('searchInverters fonksiyonu bulunamadı');
            }
            
            const response = await window.electronAPI.searchInverters({
                tables: allTables
            });

            if (!response) {
                console.error('❌ Response undefined!');
                throw new Error('Response alınamadı');
            }

            if (response.success) {
                setResults(prevResults => {
                    const newResultsMap = new Map();
                    prevResults.forEach(result => {
                        newResultsMap.set(result.tableName, result);
                    });
                    response.results.forEach(result => {
                        newResultsMap.set(result.tableName, result);
                    });
                    return Array.from(newResultsMap.values());
                });
                
                setErrors(prevErrors => {
                    const newErrorsMap = new Map();
                    prevErrors.forEach(error => {
                        newErrorsMap.set(error.tableName, error);
                    });
                    response.errors.forEach(error => {
                        newErrorsMap.set(error.tableName, error);
                    });
                    return Array.from(newErrorsMap.values());
                });
                
                setLastUpdate(new Date());
            } else {
                console.error('Inverter arama hatası:', response.error);
            }
        } catch (error) {
            console.error('Arama sırasında hata:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const getTotalInverters = () => {
        if (searchType === 'rtu-measp') {
            return results.reduce((total, result) => total + (result.totalRTUs || 0), 0);
        }
        return results.reduce((total, result) => total + (result.totalInverters || 0), 0);
    };

    const getTotalMeasurements = () => {
        return results.reduce((total, result) => total + result.totalMeasurements, 0);
    };

    // RTU verilerinde en son veriyi al
    const getLatestRTUValue = (rtuData) => {
        if (!rtuData || Object.keys(rtuData).length === 0) return null;
        
        let latestValue = null;
        let latestDate = null;
        
        Object.values(rtuData).forEach(rtuArray => {
            rtuArray.forEach(rtu => {
                if (rtu.history && rtu.history.length > 0) {
                    const lastHistory = rtu.history[0]; // En son veri
                    if (!latestDate || new Date(lastHistory.date) > new Date(latestDate)) {
                        latestDate = lastHistory.date;
                        latestValue = lastHistory.wert;
                    }
                }
            });
        });
        
        return { value: latestValue, date: latestDate };
    };

    // RTU limit kontrolü
    const checkRTULimits = (rtuData, tableName) => {
        if (!rtuData || Object.keys(rtuData).length === 0) return [];
        
        const limit = facilityLimits[tableName];
        if (!limit) return [];
        
        const limitViolations = [];
        
        Object.entries(rtuData).forEach(([rtuKey, rtuArray]) => {
            rtuArray.forEach(rtu => {
                if (rtu.history && rtu.history.length > 0) {
                    const lastHistory = rtu.history[0];
                    const value = parseFloat(lastHistory.wert);
                    if (value > limit) {
                        limitViolations.push({
                            rtuKey,
                            value,
                            limit,
                            date: lastHistory.date
                        });
                    }
                }
            });
        });
        
        return limitViolations;
    };

    const renderResults = () => {
        if (results.length === 0 && errors.length === 0) {
                    return (
            <div className="empty-state">
                <h3>GES İzleme Sistemi</h3>
                <p>Seçili GES'lerdeki Inverter verileri yükleniyor...</p>
            </div>
        );
        }

        const resultsByCity = {};
        results.forEach(result => {
            for (const [city, tables] of Object.entries(targetGES)) {
                if (tables.includes(result.tableName)) {
                    if (!resultsByCity[city]) {
                        resultsByCity[city] = [];
                    }
                    resultsByCity[city].push(result);
                    break;
                }
            }
        });

        return React.createElement('div', { className: 'content-padding' },
                                // Arama tipi seçim butonları
                    React.createElement('div', { 
                        className: 'search-type-buttons'
                    },
                                        React.createElement('button', {
                            onClick: () => {
                                setSearchType('inverters');
                                setSelectedMeasurementType('Active_Power');
                            },
                            className: searchType === 'inverters' ? 'modern-button' : 'modern-button secondary',
                    onMouseEnter: (e) => {
                        if (searchType !== 'inverters') {
                            e.target.style.transform = 'translateY(-1px)';
                            e.target.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.15)';
                        }
                    },
                    onMouseLeave: (e) => {
                        if (searchType !== 'inverters') {
                            e.target.style.transform = 'translateY(0)';
                            e.target.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
                        }
                    }
                }, 'Inverter'),
                React.createElement('button', {
                    onClick: () => {
                        setSearchType('rtu-measp');
                        setSelectedMeasurementType('Active_Power');
                    },
                    className: searchType === 'rtu-measp' ? 'modern-button success' : 'modern-button secondary',
                    onMouseEnter: (e) => {
                        if (searchType !== 'rtu-measp') {
                            e.target.style.transform = 'translateY(-1px)';
                            e.target.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.15)';
                        }
                    },
                    onMouseLeave: (e) => {
                        if (searchType !== 'rtu-measp') {
                            e.target.style.transform = 'translateY(0)';
                            e.target.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
                        }
                    }
                }, 'Analizor-Aktif Power')
            ),
            // Ölçüm tipi seçim butonları (sadece Inverter seçiliyse göster)
            searchType === 'inverters' && React.createElement('div', { 
                className: 'measurement-buttons'
            },
                ['Active_Power', 'Daily_Energy', 'DC_Input_Power_Total', 'Temperature', 'Total_Energy'].map(type => 
                    React.createElement('button', {
                        key: type,
                        onClick: () => {
                            setSelectedMeasurementType(type);
                        },
                        className: selectedMeasurementType === type ? 'modern-button' : 'modern-button secondary',
                        onMouseEnter: (e) => {
                            if (selectedMeasurementType !== type) {
                                e.target.style.transform = 'translateY(-1px)';
                                e.target.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.15)';
                            }
                        },
                        onMouseLeave: (e) => {
                            if (selectedMeasurementType !== type) {
                                e.target.style.transform = 'translateY(0)';
                                e.target.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
                            }
                        }
                    }, type.replace(/_/g, ' '))
                )
            ),
            // GES kartları - Responsive grid layout
            React.createElement('div', { 
                className: 'results-grid'
            },
                Object.entries(resultsByCity).map(([city, cityResults]) => 
                    React.createElement('div', { 
                        key: city, 
                        className: 'city-card'
                    },
                        React.createElement('div', { 
                            className: 'city-header'
                        }, 
                            React.createElement('div', { 
                                className: 'city-title'
                            },
                                React.createElement('span', { className: 'city-title-icon' }, '📍'),
                                React.createElement('span', { className: 'city-title-name' }, city)
                            ),
                            React.createElement('span', { 
                                className: 'city-badge'
                            }, `${cityResults.length} GES`)
                        ),
                                                 searchType === 'rtu-measp' ? 
                         // RTU verileri için şehir bazlı TEK grafik
                                                   React.createElement('div', { 
                              className: 'tesis-card'
                          },
                             // Şehir başlığı
                                                           React.createElement('div', { 
                                  className: 'tesis-header'
                              },
                                                                   React.createElement('div', { 
                                      className: 'city-title'
                                  },

                                                                           React.createElement('span', { 
                                          className: 'tesis-name'
                                      }, `Tüm RTU Verileri`)
                                 ),
                                                                   React.createElement('div', { 
                                      className: 'tesis-stats'
                                  },
                                     React.createElement('div', { 
                                         className: 'stat-badge success'
                                     }, `${cityResults.reduce((total, result) => total + (result.totalRTUs || 0), 0)} RTU`),
                                     React.createElement('div', { 
                                         className: 'stat-badge primary'
                                     }, `${cityResults.reduce((total, result) => total + result.totalMeasurements, 0).toLocaleString()} Ölçüm`)
                                 )
                             ),
                             // Şehir için tek RTU grafiği
                                                           React.createElement('div', { 
                                  className: 'tesis-chart-container'
                              },
                                 React.createElement(TesisChartComponent, {
                                     tesisData: { 
                                         data: cityResults.reduce((acc, cityResult) => {
                                             // Her tesisin RTU verilerini birleştir ve tesis adını ekle
                                             Object.keys(cityResult.rtuData || {}).forEach(rtuKey => {
                                                 const rtuData = cityResult.rtuData[rtuKey];
                                                 if (rtuData && rtuData.length > 0) {
                                                     // Tesis adı + RTU numarası ile key oluştur
                                                     const uniqueKey = `${cityResult.tableName}_${rtuKey}`;
                                                     acc[uniqueKey] = rtuData;
                                                 }
                                             });
                                             return acc;
                                         }, {}), 
                                         tableName: city, 
                                         searchType: 'rtu-measp' 
                                     },
                                     tesisName: city,
                                     selectedMeasurementType: selectedMeasurementType
                                 })
                             ),
                             // Limit değerleri ve RTU durumları
                             React.createElement('div', { className: 'rtu-limits-section' },
                                 React.createElement('div', { className: 'limits-grid' },
                                     cityResults.map(cityResult => {
                                         const limit = facilityLimits[cityResult.tableName];
                                         const violations = checkRTULimits(cityResult.rtuData, cityResult.tableName);
                                         const latestValue = getLatestRTUValue(cityResult.rtuData);
                                         
                                         return React.createElement('div', { 
                                             key: cityResult.tableName,
                                             className: `limit-item ${violations.length > 0 ? 'limit-exceeded' : 'limit-ok'}`
                                         },
                                             React.createElement('div', { className: 'limit-header' },
                                                 React.createElement('span', { className: 'facility-name' }, cityResult.tableName),
                                                 React.createElement('span', { className: 'limit-value' }, `Limit: ${limit}`)
                                             ),
                                             React.createElement('div', { className: 'rtu-status' },
                                                 latestValue ? 
                                                     React.createElement('div', { className: 'value-time-container' },
                                                         React.createElement('span', { 
                                                             className: `current-value ${latestValue.value > limit ? 'exceeded' : 'normal'}`
                                                         }, `Son Değer: ${latestValue.value}`),
                                                         React.createElement('span', { 
                                                             className: 'value-time'
                                                         }, `🕐 ${new Date(latestValue.date).toLocaleTimeString('tr-TR')}`)
                                                     ) :
                                                     React.createElement('span', { className: 'no-data' }, 'Veri Yok')
                                             ),
                                             violations.length > 0 && 
                                                 React.createElement('div', { className: 'violations' },
                                                     violations.map((violation, idx) => 
                                                         React.createElement('div', { 
                                                             key: idx,
                                                             className: 'violation-item'
                                                         }, 
                                                             `RTU ${violation.rtuKey}: ${violation.value} > ${violation.limit}`
                                                         )
                                                     )
                                                 )
                                         );
                                     })
                                 )
                             )
                         ) :
                         // Inverter verileri için normal tesis bazlı grafikler
                         cityResults.map((result, index) => 
                                                           React.createElement('div', { 
                                  key: index,
                                  className: 'tesis-card',
                                 onMouseEnter: (e) => {
                                     e.target.style.transform = 'translateY(-2px)';
                                     e.target.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.12)';
                                 },
                                 onMouseLeave: (e) => {
                                     e.target.style.transform = 'translateY(0)';
                                     e.target.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.06)';
                                 }
                             },
                                 // Tesis başlığı
                                                                   React.createElement('div', { 
                                      className: 'tesis-header'
                                  },
                                                                           React.createElement('div', { 
                                          className: 'tesis-title'
                                      },
                                                                                   React.createElement('span', { 
                                              className: 'tesis-name'
                                          }, result.tableName)
                                     ),
                                                                           React.createElement('div', { 
                                          className: 'tesis-stats'
                                      },
                                                                                   React.createElement('div', { 
                                              className: 'stat-badge success'
                                          }, `${result.totalInverters} Inverter`),
                                          React.createElement('div', { 
                                              className: 'stat-badge primary'
                                          }, `${result.totalMeasurements.toLocaleString()} Ölçüm`)
                                     )
                                 ),
                                 // Tesis grafiği
                                                                   React.createElement('div', { 
                                      className: 'tesis-chart-container'
                                  },
                                     React.createElement(TesisChartComponent, {
                                         tesisData: { data: result.inverterData, tableName: result.tableName, searchType: 'inverters' },
                                         tesisName: result.tableName,
                                         selectedMeasurementType: selectedMeasurementType
                                     })
                                 )
                             )
                         )
                    )
                )
            )
        );
    };

    const renderErrors = () => {
        if (errors.length === 0) return null;

        return React.createElement('div', { className: 'results-content' },
            React.createElement('h3', null, 'Hatalar'),
            errors.map((error, index) => 
                React.createElement('div', { key: index, className: 'error-message' },
                    React.createElement('strong', null, `${error.tableName}:`), ` ${error.error}`
                )
            )
        );
    };

    return React.createElement('div', { className: 'app' },
        React.createElement('div', { className: 'container' },
            React.createElement('div', { className: 'content' },

                (results.length > 0 || errors.length > 0) && 
                    React.createElement('div', { className: 'results-section' },
                        React.createElement('div', { className: 'results-header' },
                            React.createElement('div', { className: 'results-stats' },
                                React.createElement('div', { className: 'stat-item success' },
                                    `✅ ${results.length} GES'te veri bulundu (Inverter + RTU/Meas.p)`
                                ),
                                React.createElement('div', { className: 'stat-item' },
                                    `🔌 Toplam ${getTotalInverters()} ${searchType === 'rtu-measp' ? 'RTU' : 'Inverter'}`
                                ),
                                React.createElement('div', { className: 'stat-item' },
                                    `📊 Toplam ${getTotalMeasurements()} Ölçüm`
                                ),
                                lastUpdate && React.createElement('div', { className: 'stat-item' },
                                    `🕐 Son güncelleme: ${lastUpdate.toLocaleTimeString('tr-TR')}`
                                ),
                                errors.length > 0 && 
                                    React.createElement('div', { className: 'stat-item error' },
                                        `❌ ${errors.length} GES'te hata`
                                    )
                            )
                        ),
                        renderResults(),
                        errors.length > 0 && renderErrors()
                    )
            )
        )
    );
}

export default App; 
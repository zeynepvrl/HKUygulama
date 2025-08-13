const React = require('react');
const TesisChartComponent = require('./TesisChartComponent');

function App() {
    const [isLoading, setIsLoading] = React.useState(false);
    const [results, setResults] = React.useState([]);
    const [errors, setErrors] = React.useState([]);
    const [lastUpdate, setLastUpdate] = React.useState(null);
    const [selectedMeasurementType, setSelectedMeasurementType] = React.useState('Active_Power');
    const [searchType, setSearchType] = React.useState('inverters');

    const targetGES = {
        'Kırşehir': ['Espeges2', 'Ferges5', 'Somges5', 'Verdeges5'], 
        'Niğde': ['Ferges2', 'Somges2', 'Verdeges2'], 
        'Konya - Cihanbeyli': ['Verdeenerji', 'Somenerji', 'Ferenerji', 'Eforenerji'], 
        'Konya - Kulu': ['Efor1', 'Efor2', 'Fer1', 'Fer2', 'Verde', 'Som']
    }; 

    React.useEffect(() => {
        // İlk çalışma
        console.log('🚀 App useEffect - İlk veri çekme başlatılıyor');
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

    const handleSearch = async (isFullRefresh = false) => {
        setIsLoading(true);
        
        if (isFullRefresh) {
            setResults([]);
            setErrors([]);
        }

        try {
            const allTables = Object.values(targetGES).flat();
            const response = await window.electronAPI.searchInverters({
                tables: allTables
            });

            if (response.success) {
                if (isFullRefresh) {
                    setResults(response.results);
                    setErrors(response.errors);
                } else {
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
                }
                
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

    const handleManualRefresh = () => {
        handleSearch(true);
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

    const renderResults = () => {
        if (results.length === 0 && errors.length === 0) {
            return React.createElement('div', { className: 'empty-state' },
                React.createElement('h3', null, 'GES İzleme Sistemi'),
                React.createElement('p', null, 'Seçili GES\'lerdeki Inverter verileri yükleniyor...')
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

        return React.createElement('div', { style: { padding: '16px' } },
            // Arama tipi seçim butonları
            React.createElement('div', { 
                style: { 
                    display: 'flex',
                    gap: '12px',
                    marginBottom: '16px',
                    flexWrap: 'wrap',
                    justifyContent: 'center'
                }
            },
                React.createElement('button', {
                    onClick: () => {
                        setSearchType('inverters');
                        setSelectedMeasurementType('Active_Power');
                    },
                    style: {
                        background: searchType === 'inverters' 
                            ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
                            : 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
                        color: searchType === 'inverters' ? 'white' : '#475569',
                        border: '2px solid',
                        borderColor: searchType === 'inverters' ? '#667eea' : '#cbd5e1',
                        padding: '10px 16px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: '600',
                        transition: 'all 0.3s ease',
                        boxShadow: searchType === 'inverters' 
                            ? '0 4px 12px rgba(102, 126, 234, 0.3)' 
                            : '0 2px 4px rgba(0, 0, 0, 0.1)'
                    },
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
                    style: {
                        background: searchType === 'rtu-measp' 
                            ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' 
                            : 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
                        color: searchType === 'rtu-measp' ? 'white' : '#475569',
                        border: '2px solid',
                        borderColor: searchType === 'rtu-measp' ? '#10b981' : '#cbd5e1',
                        padding: '10px 16px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: '600',
                        transition: 'all 0.3s ease',
                        boxShadow: searchType === 'rtu-measp' 
                            ? '0 4px 12px rgba(16, 185, 129, 0.3)' 
                            : '0 2px 4px rgba(0, 0, 0, 0.1)'
                    },
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
                style: { 
                    display: 'flex',
                    gap: '12px',
                    marginBottom: '20px',
                    flexWrap: 'wrap',
                    justifyContent: 'center'
                }
            },
                ['Active_Power', 'Daily_Energy', 'DC_Input_Power_Total', 'Temperature', 'Total_Energy'].map(type => 
                    React.createElement('button', {
                        key: type,
                        onClick: () => {
                            setSelectedMeasurementType(type);
                        },
                        style: {
                            background: selectedMeasurementType === type 
                                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
                                : 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
                            color: selectedMeasurementType === type ? 'white' : '#475569',
                            border: '2px solid',
                            borderColor: selectedMeasurementType === type ? '#667eea' : '#cbd5e1',
                            padding: '10px 16px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: '600',
                            transition: 'all 0.3s ease',
                            boxShadow: selectedMeasurementType === type 
                                ? '0 4px 12px rgba(102, 126, 234, 0.3)' 
                                : '0 2px 4px rgba(0, 0, 0, 0.1)'
                        },
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
                style: { 
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(600px, 1fr))',
                    gap: '24px',
                    maxWidth: '100%'
                }
            },
                Object.entries(resultsByCity).map(([city, cityResults]) => 
                    React.createElement('div', { 
                        key: city, 
                        style: { 
                            border: '1px solid #e2e8f0',
                            borderRadius: '16px',
                            overflow: 'hidden',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                            background: 'white',
                            transition: 'all 0.3s ease'
                        }
                    },
                        React.createElement('div', { 
                            style: { 
                                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                                color: 'white',
                                padding: '16px 20px',
                                fontWeight: '600',
                                fontSize: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                            }
                        }, 
                            React.createElement('div', { 
                                style: { 
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px'
                                }
                            },
                                React.createElement('span', { style: { fontSize: '18px' } }, '📍'),
                                React.createElement('span', { style: { fontSize: '18px', fontWeight: '700' } }, city)
                            ),
                            React.createElement('span', { 
                                style: { 
                                    background: 'rgba(255,255,255,0.2)',
                                    padding: '6px 12px',
                                    borderRadius: '20px',
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    backdropFilter: 'blur(10px)'
                                }
                            }, `${cityResults.length} GES`)
                        ),
                        React.createElement('div', { 
                            style: { 
                                padding: '20px',
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))',
                                gap: '20px'
                            }
                        },
                            cityResults.map((result, index) => 
                                React.createElement('div', { 
                                    key: index,
                                    style: { 
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '12px',
                                        padding: '20px',
                                        background: 'white',
                                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
                                        transition: 'all 0.3s ease',
                                        position: 'relative',
                                        overflow: 'hidden',
                                        minHeight: '350px'
                                    },
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
                                            style: { 
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                marginBottom: '16px',
                                                paddingBottom: '12px',
                                                borderBottom: '2px solid #f1f5f9'
                                            }
                                        },
                                            React.createElement('div', { 
                                                style: { 
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px'
                                                }
                                            },
                                                React.createElement('div', { 
                                                    style: { 
                                                        width: '12px',
                                                        height: '12px',
                                                        borderRadius: '50%',
                                                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                                                    }
                                                }),
                                                React.createElement('span', { 
                                                    style: { 
                                                        fontWeight: '700',
                                                        color: '#1e293b',
                                                        fontSize: '16px'
                                                    }
                                                }, result.tableName),
                                                // RTU verilerinde en son veriyi göster
                                                searchType === 'rtu-measp' && (() => {
                                                    const latestRTU = getLatestRTUValue(result.rtuData);
                                                    if (latestRTU && latestRTU.value !== null) {
                                                        const latestDate = new Date(latestRTU.date);
                                                        const timeStr = latestDate.toLocaleTimeString('tr-TR', { 
                                                            hour: '2-digit', 
                                                            minute: '2-digit', 
                                                            second: '2-digit' 
                                                        });
                                                        
                                                        return React.createElement('div', {
                                                            style: {
                                                                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                                                                color: 'white',
                                                                padding: '4px 8px',
                                                                borderRadius: '6px',
                                                                fontSize: '10px',
                                                                fontWeight: '600',
                                                                marginLeft: '8px'
                                                            }
                                                        }, `Son: ${parseFloat(latestRTU.value).toFixed(2)} (${timeStr})`);
                                                    }
                                                    return null;
                                                })()
                                            ),
                                        React.createElement('div', { 
                                            style: { 
                                                display: 'flex',
                                                gap: '12px',
                                                alignItems: 'center'
                                            }
                                        },
                                            React.createElement('div', { 
                                                style: { 
                                                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                                    color: 'white',
                                                    padding: '4px 8px',
                                                    borderRadius: '6px',
                                                    fontSize: '11px',
                                                    fontWeight: '600'
                                                }
                                            }, `${searchType === 'rtu-measp' ? result.totalRTUs : result.totalInverters} ${searchType === 'rtu-measp' ? 'RTU' : 'Inverter'}`),
                                            React.createElement('div', { 
                                                style: { 
                                                    background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                                                    color: 'white',
                                                    padding: '4px 8px',
                                                    borderRadius: '6px',
                                                    fontSize: '11px',
                                                    fontWeight: '600'
                                                }
                                            }, `${result.totalMeasurements.toLocaleString()} Ölçüm`)
                                        )
                                    ),
                                                                    // Tesis grafiği
                                React.createElement('div', { 
                                    style: { 
                                        background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                                        borderRadius: '8px',
                                        padding: '16px',
                                        border: '1px solid #e2e8f0',
                                        height: '250px'
                                    }
                                },
                                                                                    React.createElement(TesisChartComponent, {
                                            tesisData: searchType === 'rtu-measp' ? { data: result.rtuData, tableName: result.tableName, searchType: 'rtu-measp' } : { data: result.inverterData, tableName: result.tableName, searchType: 'inverters' },
                                            tesisName: result.tableName,
                                            selectedMeasurementType: selectedMeasurementType
                                        })
                                    )
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
                React.createElement('div', { 
                    style: { 
                        padding: '8px 12px', 
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
                        borderRadius: '8px',
                        color: 'white',
                        marginBottom: '8px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        boxShadow: '0 2px 8px rgba(102, 126, 234, 0.2)'
                    }
                },
                    React.createElement('div', { style: { fontSize: '12px', opacity: 0.95, fontWeight: '500' } },
                        '🔄 Otomatik izleme aktif - Dakikada bir veri güncelleme'
                    ),
                    lastUpdate && React.createElement('div', { 
                        style: { 
                            fontSize: '10px', 
                            opacity: 0.9,
                            padding: '4px 8px',
                            background: 'rgba(255,255,255,0.15)',
                            borderRadius: '6px',
                            fontWeight: '500'
                        }
                    }, `🕐 ${lastUpdate.toLocaleTimeString('tr-TR')}`)
                ),
                React.createElement('button', {
                    onClick: handleManualRefresh,
                    className: 'search-button',
                    disabled: isLoading,
                    style: {
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                        border: 'none',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: '600',
                        width: '100%',
                        marginBottom: '8px',
                        boxShadow: '0 1px 4px rgba(102, 126, 234, 0.2)',
                        transition: 'all 0.2s ease'
                    }
                }, isLoading ? 
                    React.createElement(React.Fragment, null,
                        React.createElement('div', { className: 'spinner' }),
                        '⏳ Yenileniyor...'
                    ) : '🔄 Tam Yenile'
                ),
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

module.exports = App; 
// Genomic Data Visualization Functions using Plotly.js

// Color schemes for different categories
const colorSchemes = {
    effect: {
        'up': '#28a745',
        'down': '#dc3545'
    },
    strand: {
        '+': '#007bff',
        '-': '#ffc107'
    },
    chromosome: {
        'chr1': '#e74c3c',
        'chr2': '#3498db',
        'chr3': '#2ecc71',
        'chr4': '#f39c12',
        'chr5': '#9b59b6',
        'chr6': '#1abc9c',
        'chr7': '#34495e',
        'chr8': '#e67e22',
        'chr9': '#95a5a6',
        'chr10': '#e91e63'
    }
};

// Main visualization function
function createVisualization(data, chartType, colorBy) {
    const plotDiv = document.getElementById('plotlyChart');
    
    if (!data || data.length === 0) {
        plotDiv.innerHTML = '<div class="text-center p-4"><h5>No data available for visualization</h5></div>';
        return;
    }
    
    let plotData, layout;
    
    switch (chartType) {
        case 'scatter':
            ({ data: plotData, layout } = createScatterPlot(data, colorBy));
            break;
        case 'histogram':
            ({ data: plotData, layout } = createHistogram(data, colorBy));
            break;
        case 'bar':
            ({ data: plotData, layout } = createBarChart(data, colorBy));
            break;
        case 'chromosome':
            ({ data: plotData, layout } = createChromosomeDistribution(data));
            break;
        default:
            ({ data: plotData, layout } = createScatterPlot(data, colorBy));
    }
    
    const config = {
        responsive: true,
        displayModeBar: true,
        modeBarButtons: [['toImage', 'zoom2d', 'pan2d', 'zoomIn2d', 'zoomOut2d', 'autoScale2d', 'resetScale2d']],
        toImageButtonOptions: {
            format: 'png',
            filename: 'genomic_data_chart',
            height: 500,
            width: 700,
            scale: 1
        }
    };
    
    Plotly.newPlot(plotDiv, plotData, layout, config);
}

// Scatter plot: Log2FC vs Position
function createScatterPlot(data, colorBy) {
    const groups = groupDataBy(data, colorBy);
    const plotData = [];
    
    Object.keys(groups).forEach(group => {
        const groupData = groups[group];
        const trace = {
            x: groupData.map(d => (d.start + d.end) / 2), // Midpoint position
            y: groupData.map(d => d.log2fc),
            mode: 'markers',
            type: 'scatter',
            name: group,
            text: groupData.map(d => `${d.symbol || 'Unknown'}<br>Chr: ${d.chr}<br>Position: ${d.start}-${d.end}<br>Log2FC: ${d.log2fc}`),
            hovertemplate: '%{text}<extra></extra>',
            marker: {
                size: 8,
                color: getColor(group, colorBy),
                opacity: 0.7,
                line: {
                    width: 1,
                    color: 'white'
                }
            }
        };
        plotData.push(trace);
    });
    
    const layout = {
        title: {
            text: 'Log2FC vs Genomic Position',
            font: { size: 18, family: 'Arial, sans-serif' }
        },
        xaxis: {
            title: 'Genomic Position',
            gridcolor: '#f0f0f0',
            zeroline: false
        },
        yaxis: {
            title: 'Log2 Fold Change',
            gridcolor: '#f0f0f0',
            zeroline: true,
            zerolinecolor: '#666',
            zerolinewidth: 2
        },
        hovermode: 'closest',
        plot_bgcolor: 'white',
        paper_bgcolor: 'white',
        font: { family: 'Arial, sans-serif' },
        margin: { t: 50, r: 50, b: 50, l: 80 }
    };
    
    return { data: plotData, layout };
}

// Histogram: Log2FC distribution
function createHistogram(data, colorBy) {
    const groups = groupDataBy(data, colorBy);
    const plotData = [];
    
    Object.keys(groups).forEach(group => {
        const groupData = groups[group];
        const trace = {
            x: groupData.map(d => d.log2fc),
            type: 'histogram',
            name: group,
            opacity: 0.7,
            marker: {
                color: getColor(group, colorBy),
                line: {
                    width: 1,
                    color: 'white'
                }
            },
            nbinsx: 20
        };
        plotData.push(trace);
    });
    
    const layout = {
        title: {
            text: 'Log2FC Distribution',
            font: { size: 18, family: 'Arial, sans-serif' }
        },
        xaxis: {
            title: 'Log2 Fold Change',
            gridcolor: '#f0f0f0'
        },
        yaxis: {
            title: 'Frequency',
            gridcolor: '#f0f0f0'
        },
        barmode: 'overlay',
        plot_bgcolor: 'white',
        paper_bgcolor: 'white',
        font: { family: 'Arial, sans-serif' },
        margin: { t: 50, r: 50, b: 50, l: 80 }
    };
    
    return { data: plotData, layout };
}

// Bar chart: Effect counts
function createBarChart(data, colorBy) {
    const counts = {};
    const field = colorBy === 'effect' ? 'effect' : colorBy;
    
    data.forEach(d => {
        const key = d[field] || 'Unknown';
        counts[key] = (counts[key] || 0) + 1;
    });
    
    const sortedEntries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    
    const plotData = [{
        x: sortedEntries.map(([key]) => key),
        y: sortedEntries.map(([, count]) => count),
        type: 'bar',
        marker: {
            color: sortedEntries.map(([key]) => getColor(key, colorBy)),
            line: {
                width: 1,
                color: 'white'
            }
        },
        text: sortedEntries.map(([, count]) => count),
        textposition: 'auto'
    }];
    
    const layout = {
        title: {
            text: `${field.charAt(0).toUpperCase() + field.slice(1)} Distribution`,
            font: { size: 18, family: 'Arial, sans-serif' }
        },
        xaxis: {
            title: field.charAt(0).toUpperCase() + field.slice(1),
            gridcolor: '#f0f0f0'
        },
        yaxis: {
            title: 'Count',
            gridcolor: '#f0f0f0'
        },
        plot_bgcolor: 'white',
        paper_bgcolor: 'white',
        font: { family: 'Arial, sans-serif' },
        margin: { t: 50, r: 50, b: 50, l: 80 }
    };
    
    return { data: plotData, layout };
}

// Chromosome distribution
function createChromosomeDistribution(data) {
    const chrCounts = {};
    const chrAvgLog2FC = {};
    
    data.forEach(d => {
        const chr = d.chr || 'Unknown';
        chrCounts[chr] = (chrCounts[chr] || 0) + 1;
        if (!chrAvgLog2FC[chr]) chrAvgLog2FC[chr] = [];
        chrAvgLog2FC[chr].push(d.log2fc || 0);
    });
    
    // Calculate averages
    Object.keys(chrAvgLog2FC).forEach(chr => {
        const values = chrAvgLog2FC[chr];
        chrAvgLog2FC[chr] = values.reduce((a, b) => a + b, 0) / values.length;
    });
    
    const chromosomes = Object.keys(chrCounts).sort();
    
    const plotData = [
        {
            x: chromosomes,
            y: chromosomes.map(chr => chrCounts[chr]),
            type: 'bar',
            name: 'Count',
            yaxis: 'y',
            marker: {
                color: chromosomes.map(chr => getColor(chr, 'chromosome')),
                line: { width: 1, color: 'white' }
            }
        },
        {
            x: chromosomes,
            y: chromosomes.map(chr => chrAvgLog2FC[chr]),
            type: 'scatter',
            mode: 'lines+markers',
            name: 'Avg Log2FC',
            yaxis: 'y2',
            line: { color: '#ff6b6b', width: 3 },
            marker: { size: 8, color: '#ff6b6b' }
        }
    ];
    
    const layout = {
        title: {
            text: 'Data Distribution by Chromosome',
            font: { size: 18, family: 'Arial, sans-serif' }
        },
        xaxis: {
            title: 'Chromosome',
            gridcolor: '#f0f0f0'
        },
        yaxis: {
            title: 'Count',
            side: 'left',
            gridcolor: '#f0f0f0'
        },
        yaxis2: {
            title: 'Average Log2FC',
            side: 'right',
            overlaying: 'y',
            gridcolor: 'transparent'
        },
        plot_bgcolor: 'white',
        paper_bgcolor: 'white',
        font: { family: 'Arial, sans-serif' },
        margin: { t: 50, r: 80, b: 50, l: 80 },
        hovermode: 'x unified'
    };
    
    return { data: plotData, layout };
}

// Helper functions
function groupDataBy(data, field) {
    const groups = {};
    data.forEach(d => {
        const key = d[field] || 'Unknown';
        if (!groups[key]) groups[key] = [];
        groups[key].push(d);
    });
    return groups;
}

function getColor(value, colorBy) {
    if (colorSchemes[colorBy] && colorSchemes[colorBy][value]) {
        return colorSchemes[colorBy][value];
    }
    
    // Generate a consistent color based on the string
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
        hash = value.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 50%)`;
}

// Export functions for use in HTML
window.createVisualization = createVisualization;
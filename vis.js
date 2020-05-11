var render = (animate, buildTable) => {
    // Aggregate book data into buckets a certain number
    // of years wide.
    var aggregateByYear = (bucketSize) => {
        let minYear = 3000;
        let maxYear = 0;
        for (let id in bookData) {
            minYear = Math.min(minYear, bookData[id]["year"]);
            maxYear = Math.max(maxYear, bookData[id]["year"]);
        }
        // Find previous divisible year so that buckets are aligned with
        // multiples of the size.
        let bucketStart = bucketSize * Math.floor(minYear / bucketSize);
        let bucketCount = Math.ceil((maxYear - bucketStart + 1) / bucketSize);

        let buckets = [];
        for (let i = 0; i < bucketCount; i++) {
            buckets.push({
                startYear: bucketStart + i * bucketSize,
                endYear: bucketStart + (i + 1) * bucketSize - 1,
                numBooks: 0,
                numWords: 0,
                content: {}
            })
            for (let j = 0; j < 26; j++) {
                buckets[i].content[String.fromCharCode(65 + j)] = [];
            }
        }

        // Utility function to get index of bucket for a given year.
        let getBucketNum = (year) => {
            return Math.floor((year - bucketStart) / bucketSize);
        }
        for (let id in bookData) {
            let book = bookData[id];
            let idx = getBucketNum(book.year);
            buckets[idx].numBooks += 1;
            for (let key in book.contents) {
                buckets[idx].numWords += 1;
                buckets[idx].content[key].push(...book.contents[key])
            }
        }
        return buckets;
    }

    // Collapse all content data into one list 
    // i.e. remove letter indexing
    var aggregateLetters = (data) => {
        let aggregatedData = []
        for (var i in data) {
            let content = data[i].content;
            let aggContent = [];
            for (var key in content) {
                aggContent.push(...content[key]);
            }
            aggregatedData.push({
                ...data[i],
                content: aggContent
            })
        }
        return aggregatedData;
    }

    var computeFreqTables = (data) => {
        var listToFreqTable = (list) => {
            freq = {}
            for (let i in list) {
                let word = list[i];
                if (freq[word] === undefined) {
                    freq[word] = 1;
                } else {
                    freq[word] += 1;
                }
            }
            return freq;
        }
        var normalizeFreqTable = (freq) => {
            let corpusSize = 0;
            for (let key in freq) {
                corpusSize += freq[key];
            }
            for (let key in freq) {
                freq[key] /= corpusSize;
            }
            return freq;
        }
        let freqData = [...data];
        for (var i = 0; i < data.length; i++) {
            let freq = listToFreqTable(data[i].content);
            freq = normalizeFreqTable(freq);
            freqData[i].freq = freq;
        }
        return freqData;
    }

    var sortedFreqTuples = (freq) => {
        freqTuples = []
        for (let key in freq) {
            freqTuples.push([freq[key], key]);
        }
        freqTuples.sort((a, b) => { return b[0] - a[0] });
        return freqTuples;
    }

    var takeTopN = (N, data) => {
        let limitData = [];
        for (let i in data) {
            limitData.push({ ...data[i] });
        }
        var limitFreq = (freq) => {
            let freqTuples = sortedFreqTuples(freq);
            let trimmedFreq = {};
            let i = 0;
            // Keep track of last value to include all ties.
            let lastValue = -1;
            for (; i < N; i++) {
                if (i >= freqTuples.length) break;
                trimmedFreq[freqTuples[i][1]] = freqTuples[i][0];
                lastValue = freqTuples[i][0];
            }
            while (i < freqTuples.length && freqTuples[i][0] == lastValue) {
                trimmedFreq[freqTuples[i][1]] = freqTuples[i][0];
                i += 1;
            }
            return trimmedFreq;
        }
        let wordSet = new Set();
        for (let i in limitData) {
            // Initially, take the top N words in each year.
            limitData[i].freq = limitFreq(limitData[i].freq);
            // Record the top N words.
            for (let word in limitData[i].freq) {
                wordSet.add(word);
            }
        }
        /*
        Disabled, this happens way too often.

        // Make sure that we're not dropping any datapoints.
        // This would occur if a word is in the top N in one year but not another.
        for (let i in limitData) {
          wordSet.forEach((word) => { 
            if (limitData[i].freq[word] === undefined && data[i].freq[word] !== undefined) {
              console.log("Found missing datapoint!");
              limitData[i].freq[word] = data[i].freq[word];
            }
          });
        }
        */
        return limitData;
    }

    var takeWords = (words, data) => {
        let selectedData = [];
        for (let i in data) {
            selectedData.push({ ...data[i] });
        }
        for (let i in selectedData) {
            let selectedFreq = {};
            for (let j in words) {
                let wordFreq = selectedData[i].freq[words[j]];
                if (wordFreq !== undefined) {
                    selectedFreq[words[j]] = wordFreq;
                }
            }
            selectedData[i].freq = selectedFreq;
        }
        return selectedData;
    }

    var legendName = "@legend";
    var buildDataSeries = (data) => {
        series = {}
        series[legendName] = {
            name: legendName,
            type: "line",
            showInLegend: false,
            dataPoints: {},
        }
        for (var i in data) {
            // The @legend series ensures that all x-axis labels are always present.
            series[legendName].dataPoints[data[i].startYear] = {
                label: data[i].startYear + "-" + data[i].endYear,
                numBooks: data[i].numBooks,
                numWords: data[i].numWords,
                x: i,
                y: -10,
            }
            for (var word in data[i].freq) {
                if (series[word] === undefined) {
                    series[word] = {
                        name: word,
                        type: "line",
                        yValueFormatString: "#.###%",
                        showInLegend: false,
                        dataPoints: {},
                        lineDashType: "longDash",
                    }
                }
                series[word].dataPoints[data[i].startYear] = {
                    label: data[i].startYear + "-" + data[i].endYear,
                    x: i,
                    y: data[i].freq[word],
                }
            }
        }
        ret = []
        for (var key in series) {
            for (var i in data) {
                // Fill in missing datapoints with zeroes.
                // TODO: Instead, go back and find the datapoints (if they exist) 
                // in the untrimmed freq tables. This is probably more accurate.
                let interpolate = document.getElementById("interpolate").checked;
                if (!interpolate && series[key].dataPoints[data[i].startYear] === undefined) {
                    series[key].dataPoints[data[i].startYear] = {
                        x: i,
                        y: -0.00001,
                        toolTipContent: null,
                    }
                }
            }
            series[key].dataPoints = Object.keys(series[key].dataPoints).map((year) => {
                return series[key].dataPoints[year];
            })
            ret.push(series[key]);
        }
        return ret;
    }

    var bucketSize = parseInt(document.getElementById("bucketSize").value);
    var data = aggregateByYear(bucketSize);

    // Show all data or just data for one letter?
    let domain = document.getElementById("domain").value;
    if (domain !== "") {
        for (var i in data) {
            data[i].content = data[i].content[domain];
        }
    } else {
        data = aggregateLetters(data);
    }
    var untrimmedData = computeFreqTables(data);
    var N = parseInt(document.getElementById("topN").value);

    var specificWords = document.getElementById("words").value;
    if (specificWords !== "") {
        let words = splitWords(specificWords);
        data = takeWords(words, untrimmedData);
        if (words.length == 1) {
            var title = `Relative Frequency of ${specificWords} in the ABC Archive`;
        } else {
            var title = `Relative Frequencies of ${specificWords} in the ABC Archive`;
        }
    } else {
        data = takeTopN(N, untrimmedData);
        var title = `Most Frequent Words In the ABC Archive`;
    }

    // Build table.
    if (buildTable) {
        let rowCount = 0;
        let rows = []
        // Build table header and compute row count.
        let tableHeader = "";
        for (let i in untrimmedData) {
            tableHeader += `<th>${untrimmedData[i].startYear}-${untrimmedData[i].endYear}</th>`
            rowCount = Math.max(rowCount, Object.keys(untrimmedData[i].freq).length);
        }
        let tableHTML = `<tr>${tableHeader}</tr>`
        for (let i = 0; i < rowCount; i++) {
            rows.push("");
        }
        // Build rows.
        for (let i in untrimmedData) {
            let freqTuples = sortedFreqTuples(untrimmedData[i].freq);
            let j = 0;
            for (; j < freqTuples.length; j++) {
                // Make sure selected words for the previous domain/bucket size
                // are still selected.
                let className = "";
                if (selectedWords.indexOf(freqTuples[j][1]) != -1) {
                    className = "selected";
                }
                rows[j] += `<td class="${className}"
                              value="${freqTuples[j][1]}"
                              onclick="handleCellClick(this);">
                            ${freqTuples[j][1]}
                          </td>`;
            }
            for (; j < rowCount; j++) {
                rows[j] += "<td/>";
            }
        }
        // Put it all together!
        for (let i in rows) {
            tableHTML += `<tr>${rows[i]}</tr>`;
        }
        tableHTML = `<table>${tableHTML}</table>`
        document.getElementById("wordTable").innerHTML = tableHTML;
    }

    var chart = new CanvasJS.Chart("chartContainer", {
        animationEnabled: animate === true,
        animationDuration: 10000,
        zoomEnabled: true,
        zoomType: "y",
        title: {
            text: title,
        },
        axisX: {
            valueFormatString: "",
            minimum: 0,
            maximum: data.length - 1
        },
        axisY: {
            title: "Relative Frequency",
            includeZero: false,
            suffix: "%",
            minimum: 0,
            scaleBreaks: {
                autoCalculate: true,
            }
        },

        legend: {
            cursor: "pointer",
            fontSize: 16,
            itemclick: toggleDataSeries
        },
        toolTip: {
            shared: true,
            contentFormatter: function(e) {
                var content = "";

                e.entries.sort(function(a, b) {
                    return b.dataPoint.y - a.dataPoint.y;
                });

                let legendIdx = -1;
                for (var i in e.entries) {
                    if (e.entries[i].dataSeries.name === legendName) {
                        legendIdx = i;
                        break;
                    }
                }
                content += `<b>${e.entries[legendIdx].dataPoint.label}</b><br />`
                content += `<i>Book Count: ${e.entries[legendIdx].dataPoint.numBooks}<br /></i>`
                content += `<i>Word Count: ${e.entries[legendIdx].dataPoint.numWords}<br /></i>`

                var entries = e.entries;
                for (let j in entries) {
                    if (entries[j].dataPoint.y <= 0) {
                        continue;
                    }
                    // If there are lots of ties, add ellipses to indicate so.
                    if (document.getElementById("hideTies").checked && j >= N) {
                        content += "...(ties)...";
                        break;
                    }
                    let formattedY = (entries[j].dataPoint.y * 100).toFixed(3);
                    let name = entries[j].dataSeries.name;
                    content += `<span style="color:${e.entries[j].dataSeries.color}">${name}</span>: <strong>${formattedY}%</strong>`;
                    content += "<br/>";
                }
                return content;

            }
        },
        data: buildDataSeries(data),
    });
    chart.render();

    function toggleDataSeries(e) {
        if (typeof(e.dataSeries.visible) === "undefined" || e.dataSeries.visible) {
            e.dataSeries.visible = false;
        } else {
            e.dataSeries.visible = true;
        }
        chart.render();
    }
}

var splitWords = (words) => {
  return words.split(",").map((w) => { return w.toLowerCase().trim(); });
}

var selectedWords = [];

function handleCellClick(e) {
    let word = $(e).attr("value");
    let elts = $(`td[value="${word}"]`);
    let wasSelected = $(e).hasClass("selected");
    if (wasSelected) {
        selectedWords.splice(selectedWords.indexOf(word), 1);
        elts.removeClass("selected");
    } else {
        selectedWords.push(word);
        elts.addClass("selected");
    }
    document.getElementById("words").value = selectedWords.join(",");
    render();
}

// Update table state based on text box.
function updateTableSelection() {
    $(`td`).removeClass("selected");
    let words = $("#words").val().split(",");
    selectedWords = [...words];
    for (let i in words) {
        let elts = $(`td[value="${words[i]}"]`).addClass("selected");
    }
}

window.onload = function() {
    render(false, true);
}
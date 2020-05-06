var render = () => {
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
      content: {}
    })
    for (let j = 0; j < 26; j++) {
      buckets[i].content[String.fromCharCode(65+j)] = [];
    }
  }

  // Utility function to get index of bucket for a given year.
  let getBucketNum = (year) => {
    return Math.floor((year - bucketStart) / bucketSize);
  }

  for (let id in bookData) {
    let book = bookData[id];
    let idx = getBucketNum(book.year);
    for (let key in book.contents) {
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

var takeTopN = (N, data) => {
  let limitData = [...data];
  var limitFreq = (freq) => {
    freqTuples = []
    for (let key in freq) {
      freqTuples.push([freq[key], key]);
    }
    freqTuples.sort((a, b) => {return b[0] - a[0]});
    let trimmedFreq = {};
    let i = 0;
    // Keep track of last value to include all ties.
    let lastValue = -1;
    for (; i < N; i++) {
      if (i >= freqTuples.length) break;
      trimmedFreq[freqTuples[i][1]] = freqTuples[i][0];
      lastValue = freqTuples[i][0];
    }
    while(i < freqTuples.length && freqTuples[i][0] == lastValue) {
      trimmedFreq[freqTuples[i][1]] = freqTuples[i][0];
      i += 1;
    }
    return trimmedFreq;
  }
  for (var i in limitData) {
    limitData[i].freq = limitFreq(limitData[i].freq);
  }
  return limitData;
}

var buildDataSeries = (data) => {
  series = {}
  for (var i in data) {
    for (var word in data[i].freq) {
      if (series[word] === undefined) {
        series[word] = {
          name: word,
          type: "line",
          yValueFormatString: "#.###%",
          showInLegend: false,
          dataPoints: {}
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
      if (series[key].dataPoints[data[i].startYear] === undefined) {
        series[key].dataPoints[data[i].startYear] = {
          label: data[i].startYear + "-" + data[i].endYear,
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
let specificLetter = document.getElementById("domain").value;
if (specificLetter !== "") {
  for (var i in data) {
    data[i].content = data[i].content[specificLetter];
  }
} else {
  data = aggregateLetters(data);
}
data = computeFreqTables(data);
var N = 5;
data = takeTopN(N, data);
console.log(data);
console.log(buildDataSeries(data));

// Now: need to stitch together data series by word

animationDuration = document.getElementById("animate").checked ? 10000 : 0;

var chart = new CanvasJS.Chart("chartContainer", {
  animationEnabled: true,
  animationDuration: animationDuration,
  zoomEnabled: true,
  zoomType: "y",
  title:{
    text: `Most Frequent Words in the ABC Archive`
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
  /*
  legend:{
    cursor: "pointer",
    fontSize: 16,
    itemclick: toggleDataSeries
  },*/
  toolTip:{
    shared: true,
    contentFormatter: function (e) {
      var content = "";

      e.entries.sort(function(a,b) {
        return b.dataPoint.y - a.dataPoint.y;
      });

      content += e.entries[0].dataPoint.label;
      content += "<br/>";

      var entries = e.entries;
      for( let j in entries ){
        if (entries[j].dataPoint.y <= 0) {
          continue;
        }
        // If there are lots of ties, add ellipses to indicate so.
        if (j >= N) {
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

function toggleDataSeries(e){
  if (typeof(e.dataSeries.visible) === "undefined" || e.dataSeries.visible) {
    e.dataSeries.visible = false;
  }
  else{
    e.dataSeries.visible = true;
  }
  chart.render();
}

}
window.onload = function () {
  render();
}
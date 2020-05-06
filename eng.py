from collections import defaultdict
import csv
import re
import json

stopwords = ['ourselves', 'hers', 'between', 'yourself', 'but', 'again', 'there', 'about', 'once', 'during', 'out', 'very', 'having', 'with', 'they', 'own', 'an', 'be', 'some', 'for', 'do', 'its', 'yours', 'such', 'into', 'of', 'most', 'itself', 'other', 'off', 'is', 's', 'am', 'or', 'who', 'as', 'from', 'him', 'each', 'the', 'themselves', 'until', 'below', 'are', 'we', 'these', 'your', 'his', 'through', 'don', 'nor', 'me', 'were', 'her', 'more', 'himself', 'this', 'down', 'should', 'our', 'their', 'while', 'above', 'both', 'up', 'to', 'ours', 'had', 'she', 'all', 'no', 'when', 'at', 'any', 'before', 'them', 'same', 'and', 'been', 'have', 'in', 'will', 'on', 'does', 'yourselves', 'then', 'that', 'because', 'what', 'over', 'why', 'so', 'can', 'did', 'not', 'now', 'under', 'he', 'you', 'herself', 'has', 'just', 'where', 'too', 'only', 'myself', 'which', 'those', 'i', 'after', 'few', 'whom', 't', 'being', 'if', 'theirs', 'my', 'against', 'a', 'by', 'doing', 'it', 'how', 'further', 'was', 'here', 'than']
ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
stopwords.extend([x for x in ALPHABET.lower()])

# Get keys for a column title
# e.g. XYZ& -> [X, Y, Z]
def getKeys(s):
    return list(filter(lambda x: x in ALPHABET, s))

# Remove punctation (minus apostrophes) and cast all words to lowercase.
def getWords(s):
    s = re.sub('[^A-Za-z0-9\s\']','', s)    
    return [x.lower() for x in s.split() if x.lower() not in stopwords]

# Convert title format so that the spreadsheets match
# e.g. A Good Book -> Good Book, A
def convertTitle(s):
    s = s.replace("‚Äô", "'")
    if s[:2] == "A ":
        return s[2:] + ", A"
    # Can't do the same for THE because the naming is inconsistent.
    theExceptions = [
        "The Adventures of ABC",
        "The Bandit Bunny Alphabet and other stories",
        "The Modern ABC Book",
        ]
    if s in theExceptions:
        return s[4:] + ", The"
    manualCorrections = {
        "ABC Eatables":"Grandmama Goodsoul's ABC of eatables",
        "An alphabet written & pictured":"ABC: An alphabet written & pictured",
        "African ABC":"African A.B.C.",
        "An ABC":"An A. B. C. of every-day people, good, bad & indifferent",
        "An Alphabet Allegorical, Alliterative & Amusing":"An Alphabet Allegorical, Alliterative & Amusing. Appreciable at all Ages",
        "Goldfish at school":"Goldfish at School; or, The Alphabet of Frank the Fisherman",
        "Take your choice!":"Take your choice!, or, A peep at my playmates",
        "Wrights Alphabet Book":"Wright\u2019s Alphabet Book",
        "The Adventurous Billy and Betty":"Adventurous Billy & Betty, The",
        "The child's alphabet":"child's alphabet, The : emblematically described and embellished by twenty-four pictures : brought into easy verse, for the tender capacities of young readers : the whole contrived to allure children into the love of learning",
        "The infant's posture alphabet":"The Infant\u2019s Posture Alphabet; or, Harlequin\u2019s A, B, C",
        "The invited alphabet":"Invited alphabet, or, Address of A to B, The",
        "The scripture alphabet for children":"The Scripture Alphabet for children",
        "The World at Home ABC":"The world at home ABC : an alphabet of nations"
    }
    if s in manualCorrections:
        return manualCorrections[s]
    return s
    
with open('bookData.json') as metadataFile:
    rawData = json.load(metadataFile)
    data = {}
    
    titleToId = {}
    for book in rawData:
        titleToId[book['title']] = book['id']
        data[book['id']] = book

    with open('abc.csv', newline='') as csvfile:
        reader = csv.reader(csvfile, delimiter=',', quotechar='"')
        a = 0
        rows = []
        for row in reader:
            rows.append(row)
            
        key = rows[0]
        rows = rows[1:]

        for book in rows:
            bookData = {x: [] for x in ALPHABET}
            for i in range(2, len(book)):
                cell = book[i]
                words = getWords(cell)
                for k in getKeys(key[i]):
                    bookData[k].extend(words)
            bookTitle = convertTitle(book[0])
            if bookTitle not in titleToId:
                print("Data error: %s not in id index (as %s). Removing." % (book[0], bookTitle))
                continue
            data[titleToId[bookTitle]]["contents"] = bookData

        for bookId in list(data.keys()):
            if "contents" not in data[bookId]:
                del data[bookId]
                
        # Create better CSV file.
        '''
        with open('newAbc.csv', 'w', newline='') as newcsv:
            writer = csv.writer(newcsv, delimiter=',', quotechar='"', quoting=csv.QUOTE_MINIMAL)
            writer.writerow(["id"]+key)
            for row in rows:
                bookTitle = convertTitle(row[0])
                bookId = titleToId[bookTitle]
                writer.writerow([bookId, bookTitle] + row[1:])
            newcsv.close()
        '''

        print("Spreadsheets merged for %d of %d books." % (len(data), len(rows)))
        with open('data.js', 'w') as outputFile:
            outputFile.write('var bookData = ' + json.dumps(data, indent=4))
            outputFile.close()
        with open('data.json', 'w') as outputFile:
            outputFile.write(json.dumps(data, indent=4))
            outputFile.close()


    
        

from bs4 import BeautifulSoup
import csv
import time
import schedule
import urllib

'''
As of 12pm 03/27
* These numbers are subject to change based on further investigation; two previously reported cases were not in Public Health's jurisdiction.
** -- Means that case numbers are suppressed (between 1 and 4 cases in communities <25,000 people).
'''


class CoronavirusInfo:
    def __init__(self, url='http://publichealth.lacounty.gov/media/Coronavirus/locations.htm'):
        self.req = urllib.request.urlopen(url).read().decode('utf-8', 'ignore')
        self.soup = BeautifulSoup(self.req, 'lxml')
        self.nameList = []
        self.valueList = []

    def getCovidInfo(self):
        tbody = self.soup.find('tbody')
        tr = tbody.find_all('tr')
        for i in range(len(tr)):
            #name = tr[i].find('th', {'scope': 'row'}).text.replace('-', '').replace('\xa0', ' ').strip()
            name = tr[i].find('th', {'scope': 'row'}).text.replace('\xa0', ' ').strip()
            value = tr[i].find('td').text.strip()
            if name.startswith('-'):
                name = name[2:]
            if value:
                self.nameList.append(name)
                self.valueList.append(value)
            elif not value and name:
                self.nameList.append(name)
                self.valueList.append(' ')

        with open('coronavirus.csv', 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            for i in range(len(self.nameList)):
                row = [self.nameList[i]] + [self.valueList[i]]
                writer.writerow(row)


if __name__ == '__main__':
    #flag = 0
    #now = datetime.datetime.now()
    #sched_timer = datetime.datetime(now.year, now.month, now.day, 0, 5, 0)
    a = CoronavirusInfo()
    a.getCovidInfo()
    schedule.every().day.at("00:05").do(a.getCovidInfo)

    while True:
        #now = datetime.datetime.now()
        #if sched_timer < now < sched_timer + datetime.timedelta(seconds=1):
        #    time.sleep(1)
        #    a = CoronavirusInfo()
        #    a.getTotalCases()
        #    flag = 1
        #else:
        #    if flag == 1:
        #        sched_timer = sched_timer + datetime.timedelta(days=1)
        #        flag = 0
        schedule.run_pending()
        time.sleep(1)
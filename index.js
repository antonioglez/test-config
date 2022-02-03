var http = require('http');

var json = {
    "deviceGroup": "androidtv",
    "variantFeatures":[
      "dvb-dash",
      "playready",
      "outband-webvtt",
      "progressive"
    ],
    "modules": [
      "home",
      "categories",
      "sign-in",
      "channels",
      "hub-plus",
      "search",
      "britbox",
      "collections",
      "profiles"
    ],
    "services": {
      "promoted": "https://promoted.hubsvc.itv.com",
      "discovery": "https://discovery.hubsvc.itv.com",
      "static": "https://static.10ft.itv.com",
      "regionalisation": "https://regionalisation.prd.user.itv.com",
      "contentInventory": "https://content-inventory.prd.oasvc.itv.com",
      "textSearch": "https://textsearch.prd.oasvc.itv.com",
      "content": "https://content.prd.user.itv.com",
      "myList": "https://my-list.prd.user.itv.com",
      "recommendations": "https://recommendations.prd.user.itv.com"
    },
    "features": {
      "emailVerificationStandardUser": true,
      "britbox": {
        "enabled": true,
        "options": {
          "pageType": "comingSoon"
        }
      },
      "myList": true,
      "recommendations": true,
      "becauseYouWatched": true,
      "onwardJourney": true,
      "hubPlusUpsellReskin": false,
      "profilesManagement": false,
      "targetedContainers": {
        "enabled": true,
        "featured": {
          "featuredSliderSlot1": true
        },
        "promoted": {
          "promotedProductionsSliderSlot4": true,
          "promotedProductionsSliderSlot2": true,
          "promotedProductionsSliderSlot3": true,
          "promotedProductionsSliderSlot1": true
        },
        "genreSliders": {
          "genreSliderSlot1": true,
          "genreSliderSlot2": true,
          "genreSliderSlot4": true,
          "genreSliderSlot3": true
        }
      },
      "collectionsNavIcon": false
    },
    "profile": {
      "animations": true
    },
    "resources": {
      "cookiePolicy": "https://app.10ft.itv.com/itvstatic/assets/legal/cookies/connected-tv/cookies.html",
      "privacyPolicy": "https://app.10ft.itv.com/itvstatic/assets/legal/privacy/connected-tv/privacy-gdpr.html",
      "terms": "https://app.10ft.itv.com/itvstatic/assets/legal/terms/connected-tv/terms-gdpr.html"
    },
    "tracking": {
      "webVitals": "https://http-inputs-itv.splunkcloud.com/services/collector",
      "cpt": "https://cpt.itv.com/0.0.1/event",
      "pes": "https://secure.pes.itv.com/1.1.3/event",
      "ga": {
        "token": "UA-17825253-118"
      },
      "gtm": {
        "token": "GTM-52XV8MF"
      },
      "ace": {
        "url": "https://secure.pes.itv.com/ace/0.1.1/event"
      }
    },
    "abTest": {
      "endpoint": "https://api-itv-hub.conductrics.com/ac-WIaPLGnSvP/v3/agent-api/dt-VFMNUpcZWuF83rpodyGCKhul2Kh8Aw?apikey=api-VrgFgnXzcMQtgNTBTInu",
      "list": {
        "NULL_SEARCH_BUTTONS": {
          "enabled": true,
          "agent": "a-RvE9c3jlTF",
          "goals": {
            "CLICK_SEARCH_CTA": "g-yVomXr1yfW",
            "VIEW_CATEGORY_PAGE": "g-oNGQWOIFQe",
            "PLAY_VOD_S": "g-tzxd1GYTTU",
            "PLAY_VOD_M": "g-kzaU8bLbLd",
            "PLAY_SIMULCAST_S": "g-x9NqjE5WX0",
            "PLAY_SIMULCAST_M": "g-TDzkWKVGSY",
            "PLAY_CONTENT_S": "g-NpdUuFi6oX",
            "PLAY_CONTENT_M": "g-torwoFBuUz"
          },
          "data": {
            "firstRowButtons": [
              {
                "to": "categories/drama-and-soaps",
                "text": "Drama & Soaps"
              },
              {
                "to": "categories/comedy",
                "text": "Comedy"
              },
              {
                "to": "categories/entertainment",
                "text": "Entertainment"
              },
              {
                "to": "categories/factual",
                "text": "Factual"
              }
            ],
            "secondRowButtons": [
              {
                "to": "categories/full-series",
                "text": "Full Series"
              },
              {
                "to": "categories/news",
                "text": "News"
              },
              {
                "to": "categories/sport",
                "text": "Sports"
              },
              {
                "to": "categories/films",
                "text": "Films"
              }
            ]
          }
        },
        "PRIMARY_NAV_CHALLENGER_2_BRITBOX": {
          "enabled": true,
          "agent": "a-zBNhi0YASD",
          "goals": {
            "PRI_NAV_BRITBOX_CLICK_S": "g-44dRNcl49K",
            "BRITBOX_PAGE_VIEW_S": "g-eQHBDGmJ1k",
            "BRITBOX_PAGE_VIEW_M": "g-QOXuU2QTTu",
            "HUBPLUS_PAGE_VIEW_S": "g-QWyKP8vlLf",
            "HUBPLUS_SUBSCRIPTION_S": "g-XTdWcf4Wid",
            "PLAY_VOD_S": "g-tzxd1GYTTU",
            "PLAY_VOD_M": "g-kzaU8bLbLd",
            "PLAY_SIMULCAST_S": "g-x9NqjE5WX0",
            "PLAY_SIMULCAST_M": "g-TDzkWKVGSY",
            "PLAY_CONTENT_S": "g-NpdUuFi6oX",
            "PLAY_CONTENT_M": "g-torwoFBuUz"
          }
        },
        "RECS_VERSIONS": {
          "enabled": true,
          "agent": "a-XZfTx25D6X",
          "goals": {
            "PLAY_VOD_M": "g-kzaU8bLbLd",
            "PLAY_VOD_S": "g-tzxd1GYTTU",
            "CLICK_RFY_M": "g-2oXWLZiXbz",
            "CLICK_RFY_S": "g-J1nFSr7VZ8",
            "PLAY_SIMULCAST_S": "g-x9NqjE5WX0",
            "PLAY_SIMULCAST_M": "g-TDzkWKVGSY"
          }
        },
        "HOMEPAGE_CHALLENGER2": {
          "enabled": true,
          "agent": "a-cZ6RF5SNxo",
          "goals": {
            "CLICK_MOST_POP_RAIL_HOME": "g-h4Zv0ZF2in",
            "VIEW_PROGRAM_PAGE": "g-RUjRhGCVep",
            "PLAY_VOD_S": "g-tzxd1GYTTU",
            "PLAY_VOD_M": "g-kzaU8bLbLd",
            "PLAY_SIMULCAST_S": "g-x9NqjE5WX0",
            "PLAY_SIMULCAST_M": "g-TDzkWKVGSY",
            "PLAY_CONTENT_S": "g-NpdUuFi6oX",
            "PLAY_CONTENT_M": "g-torwoFBuUz"
          },
          "data": {
            "railTitle": "Trending"
          }
        },
        "PLAYERPAGE_HUBPLUS_PROMO": {
          "enabled": true,
          "agent": "a-hamCAIWGdOuO",
          "goals": {
            "CLICK_HUBPLUS_S": "g-JQG8jceAct",
            "HUBPLUS_PAGE_VIEW_S": "g-QWyKP8vlLf",
            "HUBPLUS_SUBSCRIPTION_S": "g-XTdWcf4Wid",
            "PLAY_VOD_S": "g-tzxd1GYTTU",
            "PLAY_VOD_M": "g-kzaU8bLbLd",
            "PLAY_SIMULCAST_S": "g-x9NqjE5WX0",
            "PLAY_SIMULCAST_M": "g-TDzkWKVGSY",
            "PLAY_CONTENT_S": "g-NpdUuFi6oX",
            "PLAY_CONTENT_M": "g-torwoFBuUz"
          },
          "data": {
            "ctaCopyA": "Try Hub+",
            "ctaCopyB": "Watch ad-free*"
          }
        },
        "HOMEPAGE_CHALLENGER_3": {
          "enabled": true,
          "agent": "a-iRqrvXsgQPqv",
          "goals": {
            "CLICK_CONTINUE_WATCHING": "g-gxSFi3b2dI",
            "CLICK_ANY_HOMEPAGE_RAIL": "g-5tnBIy99Ck",
            "VIEW_PROGRAM_PAGE": "g-RUjRhGCVep",
            "PLAY_VOD_S": "g-tzxd1GYTTU",
            "PLAY_VOD_M": "g-kzaU8bLbLd",
            "PLAY_SIMULCAST_S": "g-x9NqjE5WX0",
            "PLAY_SIMULCAST_M": "g-TDzkWKVGSY",
            "PLAY_CONTENT_S": "g-NpdUuFi6oX",
            "PLAY_CONTENT_M": "g-torwoFBuUz"
          }
        },
        "NAV_CHALLENGER_1": {
          "enabled": true,
          "agent": "a-MaW9hRHlbY",
          "goals": {
            "VIEW_ANY_CATEGORY_PAGE_M": "g-cRacsGiXZV",
            "VIEW_FULL_SERIES_CATEGORY_PAGE_S": "g-IBPqCtHTN7",
            "VIEW_CHILDREN_CATEGORY_PAGE_S": "g-tm7WBUlxeZ",
            "VIEW_COMEDY_CATEGORY_PAGE_S": "g-Ld5aUGNXMo",
            "VIEW_DRAMASOAPS_CATEGORY_PAGE_S": "g-YOtUPt3ys8",
            "VIEW_ENTERTAINMENT_CATEGORY_PAGE_S": "g-RZ0GWQnM8V",
            "VIEW_FACTUAL_CATEGORY_PAGE_S": "g-A26sNKnSja",
            "VIEW_FILMS_CATEGORY_PAGE_S": "g-184rve93On",
            "VIEW_NEWS_CATEGORY_PAGE_S": "g-nfH783jk4Q",
            "VIEW_SPORT_CATEGORY_PAGE_S": "g-Gyk2nMmko0",
            "VIEW_PROGRAM_PAGE": "g-RUjRhGCVep",
            "PLAY_VOD_S": "g-tzxd1GYTTU",
            "PLAY_VOD_M": "g-kzaU8bLbLd",
            "PLAY_SIMULCAST_S": "g-x9NqjE5WX0",
            "PLAY_SIMULCAST_M": "g-TDzkWKVGSY",
            "PLAY_CONTENT_S": "g-NpdUuFi6oX",
            "PLAY_CONTENT_M": "g-torwoFBuUz"
          }
        },
        "CAT_CHALLENGER_TOP_PICKS": {
          "enabled": true,
          "agent": "a-jHW9H75XmiI7",
          "goals": {
            "CLICK_TOP_PICK_RAIL_S": "g-ivbFwi7YdB",
            "CLICK_TOP_PICK_RAIL_M": "g-81vbRChogR",
            "CLICK_PROGRAMME_S": "g-QDvWtOxnWL",
            "VIEW_PROGRAM_PAGE": "g-RUjRhGCVep",
            "PLAY_VOD_S": "g-tzxd1GYTTU",
            "PLAY_VOD_M": "g-kzaU8bLbLd",
            "PLAY_SIMULCAST_S": "g-x9NqjE5WX0",
            "PLAY_SIMULCAST_M": "g-TDzkWKVGSY",
            "PLAY_CONTENT_S": "g-NpdUuFi6oX",
            "PLAY_CONTENT_M": "g-torwoFBuUz"
          }
        },
        "RICH_IMAGE_ASSETS": {
          "enabled": true,
          "agent": "a-MMIcwI1ExxKS",
          "goals": {
            "CLICK_ANY_DRAMASOAP_TILE_M": "g-AfZ7eqS4Ir",
            "CLICK_ANY_DRAMASOAP_TILE_S": "g-9xmlQ8LMFR",
            "CLICK_RICH_IMAGE_TILE_M": "g-Lj1lCPPapl",
            "CLICK_RICH_IMAGE_TILE_S": "g-1vy7Bk6GYY",
            "VIEW_PROGRAM_PAGE": "g-RUjRhGCVep",
            "PLAY_VOD_S": "g-tzxd1GYTTU",
            "PLAY_VOD_M": "g-kzaU8bLbLd",
            "PLAY_SIMULCAST_S": "g-x9NqjE5WX0",
            "PLAY_SIMULCAST_M": "g-TDzkWKVGSY",
            "PLAY_CONTENT_S": "g-NpdUuFi6oX",
            "PLAY_CONTENT_M": "g-torwoFBuUz"
          },
          "data": {
            "programmes": [
              {
                "programmeId": "2_7844",
                "title": "Des",
                "image": "https://hubimages.itv.com/episode/2_7844_0003?w={width}&h={height}&q={quality}&blur={blur}&bg={bg}"
              },
              {
                "programmeId": "2_5041",
                "title": "The Bay",
                "image": "https://hubimages.itv.com/episode/2_5041_0012?w={width}&h={height}&q={quality}&blur={blur}&bg={bg}"
              },
              {
                "programmeId": "7_0127",
                "title": "Finding Alice",
                "image": "https://hubimages.itv.com/episode/7_0127_0006?w={width}&h={height}&q={quality}&blur={blur}&bg={bg}"
              },
              {
                "programmeId": "2_4269",
                "title": "Marcella",
                "image": "https://hubimages.itv.com/episode/2_4269_0025?w={width}&h={height}&q={quality}&blur={blur}&bg={bg}"
              },
              {
                "programmeId": "2_6732",
                "title": "The Pembrokeshire Murders",
                "image": "https://hubimages.itv.com/episode/2_6732_0003?w={width}&h={height}&q={quality}&blur={blur}&bg={bg}"
              },
              {
                "programmeId": "2_7595",
                "title": "The Sister",
                "image": "https://hubimages.itv.com/episode/2_7595_0004?w={width}&h={height}&q={quality}&blur={blur}&bg={bg}"
              },
              {
                "programmeId": "2_7534",
                "title": "Honour",
                "image": "https://hubimages.itv.com/episode/2_7534_0002?w={width}&h={height}&q={quality}&blur={blur}&bg={bg}"
              },
              {
                "programmeId": "2_7035",
                "title": "The Singapore Grip",
                "image": "https://hubimages.itv.com/episode/2_7035_0006?w={width}&h={height}&q={quality}&blur={blur}&bg={bg}"
              },
              {
                "programmeId": "2_3958",
                "title": "Tina & Bobby",
                "image": "https://hubimages.itv.com/episode/2_3958_0003?w={width}&h={height}&q={quality}&blur={blur}&bg={bg}"
              }
            ]
          }
        },
        "ONWARD_JOURNEY_RECOMMENDATION": {
          "enabled": true,
          "agent": "a-qBXMXdBHF4KG",
          "goals": {
            "CLICK_RECOMMENDED_S": "g-qS8jUIJ4M0",
            "CLICK_RECOMMENDED_M": "g-qhxXBliNp9",
            "VIEW_PROGRAM_PAGE": "g-RUjRhGCVep",
            "HUBPLUS_PAGE_VIEW_S": "g-QWyKP8vlLf",
            "PLAY_VOD_S": "g-tzxd1GYTTU",
            "PLAY_VOD_M": "g-kzaU8bLbLd",
            "PLAY_SIMULCAST_S": "g-x9NqjE5WX0",
            "PLAY_SIMULCAST_M": "g-TDzkWKVGSY",
            "PLAY_CONTENT_S": "g-NpdUuFi6oX",
            "PLAY_CONTENT_M": "g-torwoFBuUz"
          }
        }
      }
    }
  };

var app = http.createServer(function(req,res){
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.end(JSON.stringify(json));
});
app.listen(8080);

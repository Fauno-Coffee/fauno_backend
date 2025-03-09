const ApiError = require('../error/ApiError')
const axios = require("axios");

class McsController {
    async send (req, res, next) {
        try {
            let {first_name, last_name, phone, mail, jobTitles, link, how, industry, why, country, company, nationality, utm_content = '', utm_campaign = '', utm_medium = '', utm_source = '', utm_term = ''} = req.body;

            let postData 
            if(how === "Online"){
                postData = JSON.stringify([{
                    "name": "Регистрация",
                    "pipeline_id": 8764342,
                    "status_id": 70915014,
                    "_embedded":{
                        "contacts": [{
                            "first_name": first_name,
                            "cont_name": first_name + ' ' + last_name,
                            "custom_fields_values": [
                                {"field_id": 1642373, "values": [{"value": last_name}]},
                                {"field_id": 362663, "values": [{"value": phone}]},
                                {"field_id": 362665, "values": [{"value": mail}]},
                                {"field_id": 362661, "values": [{"value": jobTitles}]},
                                {"field_id": 1617197, "values": [{"value": jobTitles}]},
                                {"field_id": 1617189, "values": [{"value": link}]},
                                {"field_id": 1617201, "values": [{"value": how}]},
                                {"field_id": 1617191, "values": [{"value": industry}]},
                                {"field_id": 1617203, "values": [{"value": why}]},
                                {"field_id": 1617193, "values": [{"value": country}]},
                                {"field_id": 1617205, "values": [{"value": country}]},
                                {"field_id": 1617195, "values": [{"value": company}]},
                                {"field_id": 1617199, "values": [{"value": nationality}]},
                                {"field_id": 1616911, "values": [{"value": utm_content}]},
                                {"field_id": 1616909, "values": [{"value": utm_campaign}]},
                                {"field_id": 1616907, "values": [{"value": utm_medium}]},
                                {"field_id": 1616905, "values": [{"value": utm_source}]},
                                {"field_id": 1616913, "values": [{"value": utm_term}]}
                            ]
                        }],
                        "companies": [{
                            "name": company
                        }]
                
                    },
                    "responsible_user_id": 10792982
                }])
            } else {
                postData = JSON.stringify([{
                    "name": "Регистрация",
                    "pipeline_id": 8764342,
                    "status_id": 70915018,
                    "_embedded":{
                        "contacts": [{
                            "first_name": first_name,
                            "cont_name": first_name + ' ' + last_name,
                            "custom_fields_values": [
                                {"field_id": 1642373, "values": [{"value": last_name}]},
                                {"field_id": 362663, "values": [{"value": phone}]},
                                {"field_id": 362665, "values": [{"value": mail}]},
                                {"field_id": 362661, "values": [{"value": jobTitles}]},
                                {"field_id": 1617197, "values": [{"value": jobTitles}]},
                                {"field_id": 1617189, "values": [{"value": link}]},
                                {"field_id": 1617201, "values": [{"value": how}]},
                                {"field_id": 1617191, "values": [{"value": industry}]},
                                {"field_id": 1617203, "values": [{"value": why}]},
                                {"field_id": 1617193, "values": [{"value": country}]},
                                {"field_id": 1617205, "values": [{"value": country}]},
                                {"field_id": 1617195, "values": [{"value": company}]},
                                {"field_id": 1617199, "values": [{"value": nationality}]},
                                {"field_id": 1616911, "values": [{"value": utm_content}]},
                                {"field_id": 1616909, "values": [{"value": utm_campaign}]},
                                {"field_id": 1616907, "values": [{"value": utm_medium}]},
                                {"field_id": 1616905, "values": [{"value": utm_source}]},
                                {"field_id": 1616913, "values": [{"value": utm_term}]}
                            ]
                        }],
                        "companies": [{
                            "name": company
                        }]
                
                    },
                    "responsible_user_id": 10792982
                }])
            }

            let config = {
                method: 'post',
                maxBodyLength: Infinity,
                url: 'https://mtsai.amocrm.ru/api/v4/leads/complex',
                headers: { 
                  'Authorization': 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImp0aSI6ImQ1NjAyOGU1NTFjOTFhOTY0MzBkZWU1YmMwZTczZDRiMjI3ZTBhYzBmNWFkMTcyOTg2YmM5ZjE2ZTI5ZDg0ZGM5MDUyOTYxNTIyZTMzYzE2In0.eyJhdWQiOiIxYTJjMGI3MC1mY2I4LTQ5YmQtOTlhNi1mZWIyNWI2ZDVkOWIiLCJqdGkiOiJkNTYwMjhlNTUxYzkxYTk2NDMwZGVlNWJjMGU3M2Q0YjIyN2UwYWMwZjVhZDE3Mjk4NmJjOWYxNmUyOWQ4NGRjOTA1Mjk2MTUyMmUzM2MxNiIsImlhdCI6MTcyOTEyMTEzNCwibmJmIjoxNzI5MTIxMTM0LCJleHAiOjE4MzM4NDAwMDAsInN1YiI6IjEwNzkyOTgyIiwiZ3JhbnRfdHlwZSI6IiIsImFjY291bnRfaWQiOjMxMzQ5MzI2LCJiYXNlX2RvbWFpbiI6ImFtb2NybS5ydSIsInZlcnNpb24iOjIsInNjb3BlcyI6WyJjcm0iLCJmaWxlcyIsImZpbGVzX2RlbGV0ZSIsIm5vdGlmaWNhdGlvbnMiLCJwdXNoX25vdGlmaWNhdGlvbnMiXSwiaGFzaF91dWlkIjoiOWQxMWJiOTgtZDkyMC00MTYyLWE4ZDMtMmRmOTUzYzQzNGEyIiwiYXBpX2RvbWFpbiI6ImFwaS1iLmFtb2NybS5ydSJ9.iFvAfIM81ki4on60n_580Qn4h_5Jf6gRdDjPxKYxojr5lnM0KSXvUHrkm1mxEiuq89QiFNbTHKW_SwDKZ2doSlnxX5bpBKsOkKn3WQYU-t1Xk44Bf7KQ4pVoZB81B93JR2A8sTpukQm8yxS5RvywtF2aH0vqBF0BqwFxngSNjghMrDX8F7V3PIQ0nXvj_xG87WfbXNeXaMYqnejBtZwwVTCMqPsFACRMvsiGN54hKrrYgelOMFxDiQxBoVcun6DUC-fMI6059WGTxOkUtdCzmgq3Z1a9nF95FthpyqQYk0s183lP12_5DsUzaylBokp59UiVct3cc5IekPVzwAA_yQ', 
                  'Content-Type': 'application/json', 
                  'Cookie': 'session_id=gi47sl5vakspsmqd7en8f0ohla; user_lang=ru'
                },
                data: postData
            };
              
                try{
                    const responce = await axios.request(config)
                    return res.json(responce)
                }catch(e){
                    console.log(e)
                    return res.json({message: e})
                }     
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }
    async sendAWS (req, res, next) {
        try {
            let {first_name, last_name, mail, company, utm_content = '', utm_campaign = '', utm_medium = '', utm_source = '', utm_term = ''} = req.body;

            const postData = JSON.stringify([{
                "name": "Регистрация AWS",
                "pipeline_id": 8764342,
                "status_id": 74697018,
                "_embedded":{
                    "contacts": [{
                        "first_name": first_name,
                        "cont_name": first_name + ' ' + last_name,
                        "custom_fields_values": [
                            {"field_id": 1642373, "values": [{"value": last_name}]},
                            {"field_id": 362665, "values": [{"value": mail}]},
                            {"field_id": 1617195, "values": [{"value": company}]},
                            {"field_id": 1616911, "values": [{"value": utm_content}]},
                            {"field_id": 1616909, "values": [{"value": utm_campaign}]},
                            {"field_id": 1616907, "values": [{"value": utm_medium}]},
                            {"field_id": 1616905, "values": [{"value": utm_source}]},
                            {"field_id": 1616913, "values": [{"value": utm_term}]}
                        ]
                    }],
                    "companies": [{
                        "name": company
                    }]
            
                },
                "responsible_user_id": 10792982
            }])

            let config = {
                method: 'post',
                maxBodyLength: Infinity,
                url: 'https://mtsai.amocrm.ru/api/v4/leads/complex',
                headers: { 
                  'Authorization': 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImp0aSI6ImQ1NjAyOGU1NTFjOTFhOTY0MzBkZWU1YmMwZTczZDRiMjI3ZTBhYzBmNWFkMTcyOTg2YmM5ZjE2ZTI5ZDg0ZGM5MDUyOTYxNTIyZTMzYzE2In0.eyJhdWQiOiIxYTJjMGI3MC1mY2I4LTQ5YmQtOTlhNi1mZWIyNWI2ZDVkOWIiLCJqdGkiOiJkNTYwMjhlNTUxYzkxYTk2NDMwZGVlNWJjMGU3M2Q0YjIyN2UwYWMwZjVhZDE3Mjk4NmJjOWYxNmUyOWQ4NGRjOTA1Mjk2MTUyMmUzM2MxNiIsImlhdCI6MTcyOTEyMTEzNCwibmJmIjoxNzI5MTIxMTM0LCJleHAiOjE4MzM4NDAwMDAsInN1YiI6IjEwNzkyOTgyIiwiZ3JhbnRfdHlwZSI6IiIsImFjY291bnRfaWQiOjMxMzQ5MzI2LCJiYXNlX2RvbWFpbiI6ImFtb2NybS5ydSIsInZlcnNpb24iOjIsInNjb3BlcyI6WyJjcm0iLCJmaWxlcyIsImZpbGVzX2RlbGV0ZSIsIm5vdGlmaWNhdGlvbnMiLCJwdXNoX25vdGlmaWNhdGlvbnMiXSwiaGFzaF91dWlkIjoiOWQxMWJiOTgtZDkyMC00MTYyLWE4ZDMtMmRmOTUzYzQzNGEyIiwiYXBpX2RvbWFpbiI6ImFwaS1iLmFtb2NybS5ydSJ9.iFvAfIM81ki4on60n_580Qn4h_5Jf6gRdDjPxKYxojr5lnM0KSXvUHrkm1mxEiuq89QiFNbTHKW_SwDKZ2doSlnxX5bpBKsOkKn3WQYU-t1Xk44Bf7KQ4pVoZB81B93JR2A8sTpukQm8yxS5RvywtF2aH0vqBF0BqwFxngSNjghMrDX8F7V3PIQ0nXvj_xG87WfbXNeXaMYqnejBtZwwVTCMqPsFACRMvsiGN54hKrrYgelOMFxDiQxBoVcun6DUC-fMI6059WGTxOkUtdCzmgq3Z1a9nF95FthpyqQYk0s183lP12_5DsUzaylBokp59UiVct3cc5IekPVzwAA_yQ', 
                  'Content-Type': 'application/json', 
                  'Cookie': 'session_id=gi47sl5vakspsmqd7en8f0ohla; user_lang=ru'
                },
                data: postData
            };
              
                try{
                    const responce = await axios.request(config)
                    return res.json(responce)
                }catch(e){
                    console.log(e)
                    return res.json({message: e})
                }     
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }
    async sendSAP (req, res, next) {
        try {
            let {first_name, last_name, mail, company, utm_content = '', utm_campaign = '', utm_medium = '', utm_source = '', utm_term = ''} = req.body;

            const postData = JSON.stringify([{
                "name": "Регистрация SAP",
                "pipeline_id": 8764342,
                "status_id": 74697022,
                "_embedded":{
                    "contacts": [{
                        "first_name": first_name,
                        "cont_name": first_name + ' ' + last_name,
                        "custom_fields_values": [
                            {"field_id": 1642373, "values": [{"value": last_name}]},
                            {"field_id": 362665, "values": [{"value": mail}]},
                            {"field_id": 1617195, "values": [{"value": company}]},
                            {"field_id": 1616911, "values": [{"value": utm_content}]},
                            {"field_id": 1616909, "values": [{"value": utm_campaign}]},
                            {"field_id": 1616907, "values": [{"value": utm_medium}]},
                            {"field_id": 1616905, "values": [{"value": utm_source}]},
                            {"field_id": 1616913, "values": [{"value": utm_term}]}
                        ]
                    }],
                    "companies": [{
                        "name": company
                    }]
            
                },
                "responsible_user_id": 10792982
            }])

            let config = {
                method: 'post',
                maxBodyLength: Infinity,
                url: 'https://mtsai.amocrm.ru/api/v4/leads/complex',
                headers: { 
                  'Authorization': 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImp0aSI6ImQ1NjAyOGU1NTFjOTFhOTY0MzBkZWU1YmMwZTczZDRiMjI3ZTBhYzBmNWFkMTcyOTg2YmM5ZjE2ZTI5ZDg0ZGM5MDUyOTYxNTIyZTMzYzE2In0.eyJhdWQiOiIxYTJjMGI3MC1mY2I4LTQ5YmQtOTlhNi1mZWIyNWI2ZDVkOWIiLCJqdGkiOiJkNTYwMjhlNTUxYzkxYTk2NDMwZGVlNWJjMGU3M2Q0YjIyN2UwYWMwZjVhZDE3Mjk4NmJjOWYxNmUyOWQ4NGRjOTA1Mjk2MTUyMmUzM2MxNiIsImlhdCI6MTcyOTEyMTEzNCwibmJmIjoxNzI5MTIxMTM0LCJleHAiOjE4MzM4NDAwMDAsInN1YiI6IjEwNzkyOTgyIiwiZ3JhbnRfdHlwZSI6IiIsImFjY291bnRfaWQiOjMxMzQ5MzI2LCJiYXNlX2RvbWFpbiI6ImFtb2NybS5ydSIsInZlcnNpb24iOjIsInNjb3BlcyI6WyJjcm0iLCJmaWxlcyIsImZpbGVzX2RlbGV0ZSIsIm5vdGlmaWNhdGlvbnMiLCJwdXNoX25vdGlmaWNhdGlvbnMiXSwiaGFzaF91dWlkIjoiOWQxMWJiOTgtZDkyMC00MTYyLWE4ZDMtMmRmOTUzYzQzNGEyIiwiYXBpX2RvbWFpbiI6ImFwaS1iLmFtb2NybS5ydSJ9.iFvAfIM81ki4on60n_580Qn4h_5Jf6gRdDjPxKYxojr5lnM0KSXvUHrkm1mxEiuq89QiFNbTHKW_SwDKZ2doSlnxX5bpBKsOkKn3WQYU-t1Xk44Bf7KQ4pVoZB81B93JR2A8sTpukQm8yxS5RvywtF2aH0vqBF0BqwFxngSNjghMrDX8F7V3PIQ0nXvj_xG87WfbXNeXaMYqnejBtZwwVTCMqPsFACRMvsiGN54hKrrYgelOMFxDiQxBoVcun6DUC-fMI6059WGTxOkUtdCzmgq3Z1a9nF95FthpyqQYk0s183lP12_5DsUzaylBokp59UiVct3cc5IekPVzwAA_yQ', 
                  'Content-Type': 'application/json', 
                  'Cookie': 'session_id=gi47sl5vakspsmqd7en8f0ohla; user_lang=ru'
                },
                data: postData
            };
              
                try{
                    const responce = await axios.request(config)
                    return res.json(responce)
                }catch(e){
                    console.log(e)
                    return res.json({message: e})
                }     
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }
    async fetch (req, res, next) {
        try {
            let {id} = req.params;

            let headers = { 
                'Authorization': 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImp0aSI6ImQ1NjAyOGU1NTFjOTFhOTY0MzBkZWU1YmMwZTczZDRiMjI3ZTBhYzBmNWFkMTcyOTg2YmM5ZjE2ZTI5ZDg0ZGM5MDUyOTYxNTIyZTMzYzE2In0.eyJhdWQiOiIxYTJjMGI3MC1mY2I4LTQ5YmQtOTlhNi1mZWIyNWI2ZDVkOWIiLCJqdGkiOiJkNTYwMjhlNTUxYzkxYTk2NDMwZGVlNWJjMGU3M2Q0YjIyN2UwYWMwZjVhZDE3Mjk4NmJjOWYxNmUyOWQ4NGRjOTA1Mjk2MTUyMmUzM2MxNiIsImlhdCI6MTcyOTEyMTEzNCwibmJmIjoxNzI5MTIxMTM0LCJleHAiOjE4MzM4NDAwMDAsInN1YiI6IjEwNzkyOTgyIiwiZ3JhbnRfdHlwZSI6IiIsImFjY291bnRfaWQiOjMxMzQ5MzI2LCJiYXNlX2RvbWFpbiI6ImFtb2NybS5ydSIsInZlcnNpb24iOjIsInNjb3BlcyI6WyJjcm0iLCJmaWxlcyIsImZpbGVzX2RlbGV0ZSIsIm5vdGlmaWNhdGlvbnMiLCJwdXNoX25vdGlmaWNhdGlvbnMiXSwiaGFzaF91dWlkIjoiOWQxMWJiOTgtZDkyMC00MTYyLWE4ZDMtMmRmOTUzYzQzNGEyIiwiYXBpX2RvbWFpbiI6ImFwaS1iLmFtb2NybS5ydSJ9.iFvAfIM81ki4on60n_580Qn4h_5Jf6gRdDjPxKYxojr5lnM0KSXvUHrkm1mxEiuq89QiFNbTHKW_SwDKZ2doSlnxX5bpBKsOkKn3WQYU-t1Xk44Bf7KQ4pVoZB81B93JR2A8sTpukQm8yxS5RvywtF2aH0vqBF0BqwFxngSNjghMrDX8F7V3PIQ0nXvj_xG87WfbXNeXaMYqnejBtZwwVTCMqPsFACRMvsiGN54hKrrYgelOMFxDiQxBoVcun6DUC-fMI6059WGTxOkUtdCzmgq3Z1a9nF95FthpyqQYk0s183lP12_5DsUzaylBokp59UiVct3cc5IekPVzwAA_yQ', 
                'Content-Type': 'application/json', 
                'Cookie': 'session_id=gi47sl5vakspsmqd7en8f0ohla; user_lang=ru'
            }

            let responce
              
            try{
                responce = await axios.get(`https://mtsai.amocrm.ru/api/v4/leads/${id}?with=contacts`, {headers, maxBodyLength: Infinity})
                let url = responce.data._embedded.contacts[0]._links.self.href
                let contact = await axios.get(url, {headers, maxBodyLength: Infinity})
                
                let first_name = contact.data.first_name
                
                let custom_fields_values = contact.data.custom_fields_values
                
                let last_name = ''
                let company = ''
                
                custom_fields_values.forEach(element => {
                    if(element.field_id == 1642373){
                        try{
                            last_name = element.values[0].value
                        } catch (e) {
                            last_name = ""
                        }
                    }
                    if(element.field_id == 1617195){
                        try{
                            company = element.values[0].value
                        } catch (e) {
                            company = ""
                        }
                    }
                });

                return res.json({name: `${first_name} ${last_name}`, company: company})
            }catch(e){
                console.log(e)
                return res.json({responce: responce})
            }     
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }
}

module.exports = new McsController()
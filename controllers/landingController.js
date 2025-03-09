const MailSending = require('../utils/mail')

String.prototype.hashLarge = function() {
    var self = this, range = Array(this.length);
    for(var i = 0; i < this.length; i++) {
      range[i] = i;
    } 
    return Array.prototype.reduce.call(range, function(sum, i) {
      return sum + self.charCodeAt(i);
    }, 0).toString(16);
}

class LandingController {
    async help(req, res, next) {
        let {helpName, helpPhone, helpMail} = req.body;
        MailSending.landingMail('Помощь в подключении', helpName, helpPhone, helpMail)
        return res.json("Спасибо!")
    }

    async contact(req, res, next) {
        let {contactName, contactPhone, contactMail} = req.body;
        MailSending.landingMail('Нужна обратная связь', contactName, contactPhone, contactMail)
    }

    async IDPcontact (req, res, next) {
        let {contactName, contactCompany, contactContact, contactMessage} = req.body;
        if (contactContact.match(/^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|.(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/)) {
            MailSending.IDPlandingMail(contactName, contactContact)
            MailSending.IDPlandingMailtoYaroslav(contactName, contactCompany, contactContact, contactMessage)
        } else {
            MailSending.IDPlandingMailtoYaroslav(contactName, contactCompany, contactContact, contactMessage)
        }
        return res.json("Great!")
        
    }

    async diamart (req, res, next) {
        let {name, mail, phone, message} = req.body;
        if (mail.match(/^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|.(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/)) {
            MailSending.DiamartLanding(name, mail)
            MailSending.DiamartToNazim(name, phone, mail, message)
        } else {
            MailSending.DiamartToNazim(name, phone, mail, message)
        }
        
        return res.json("Great!")
    }
}

module.exports = new LandingController()

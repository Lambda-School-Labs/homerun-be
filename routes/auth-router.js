/* eslint-disable no-unused-vars */
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const Members = require('../models/members-model.js');
const Households = require('../models/households-model.js');
const {
  account: AccountConfirmations,
  password: PasswordConfirmations,
} = require('../models/confirmations-model.js');
const { generateToken } = require('../middleware/token.js');
const sendMail = require('../middleware/sendMail.js');
const templates = require('../middleware/emailTemplates.js');
const generatePIN = require('../middleware/generatePIN');
const { nanoid } = require('nanoid');
const axios = require('axios');
const { token } = require('morgan');
const googleAuthMiddleware = require('../middleware/googleAuth');

router.post('/google', googleAuthMiddleware, (req, res) => {
  const { email } = res.googleInfo;

  if (email) {
    Members.getByEmail(email)
      .then((member) => {
        if (member) {
          const token = generateToken(member);
          res.status(200).json({
            message: `Welcome, ${member.email}`,
            token,
            member_id: member.id,
            username: member.username,
          });
        } else {
          const googleHash = nanoid();
          AccountConfirmations.insert({
            email: res.googleInfo.email,
            id: googleHash,
          })
            .then((hash) => {
              res.status(200).json({ message: 'Success!', response: hash });
            })
            .catch((err) => console.log('error', err));
        }
      })
      .catch((err) => console.log('error', err));
  }
});

router.post('/signup', (req, res) => {
  const { email } = req.body;
  if (email) {
    // a user with this email needs to not exist already
    Members.getByEmail(email).then((result) => {
      if (result) {
        res
          .status(400)
          .json({ message: 'A member with that email already exists' });
      } else {
        const id = nanoid();
        const pin = generatePIN();
        // previous confirmations are invalidated
        AccountConfirmations.remove(email)
          .then(() => AccountConfirmations.insert({ id, pin, email }))
          .then(({ pin, email }) => {
            sendMail(email, templates.confirmation(pin))
              .then(() => {
                res.status(200).json({
                  message: 'A confirmation email has been sent',
                  email,
                });
              })
              .catch((e) => {
                res
                  .status(500)
                  .json({ message: 'Email service failed to send' });
              });
          })
          .catch((e) => {
            console.log(e);
            res.status(500).json({
              message:
                'Failed to store confirmation information in the database',
            });
          });
      }
    });
  } else {
    res.status(401).json({ message: 'Request body missing email' });
  }
});

router.post('/verify-pin', (req, res) => {
  let { email, pin } = req.body;
  if (email && pin) {
    AccountConfirmations.getByEmailAndPin(email, pin).then((conf) => {
      if (conf) {
        res.status(200).json({ id: conf.id });
      } else {
        res.status(404).json({
          message: 'email and pin combination not found in confirmations',
        });
      }
    });
  } else {
    res.status(400).json({ message: 'Request body missing email or pin' });
  }
});

router.post('/login', (req, res) => {
  const credentials = req.body;
  if (credentials.email && credentials.password) {
    Members.getByEmail(credentials.email)
      .then((member) => {
        if (bcrypt.compareSync(credentials.password, member.password)) {
          const token = generateToken(member);
          res.status(200).json({
            message: `Welcome, ${member.email}`,
            token,
            member_id: member.id,
            username: member.username,
          });
        } else {
          res.status(401).json({ message: 'Invalid credentials' });
        }
      })
      .catch(() => {
        res.status(401).json({ message: 'Invalid credentials' });
      });
  } else {
    res.status(400).json({ message: 'Request body missing email or password' });
  }
});

router.post('/confirm', async (req, res) => {
  let { username, password, confirmation_id } = req.body;
  const errors = [
    { status: 401, message: 'Request body missing username or password' },
    { status: 404, message: 'Confirmation hash not found' },
    { status: 400, message: 'Username is already taken' },
    { status: 500, message: 'Unable to insert autogenerated household' },
    { status: 500, message: 'Unable to insert member' },
  ];
  let cur_err = errors[0];
  if (username && password && confirmation_id) {
    try {
      cur_err = errors[1];
      const confirmation = await AccountConfirmations.getbyId(confirmation_id);
      if (!confirmation) throw null;

      cur_err = errors[2];
      if (await Members.getByUsername(username)) throw null;

      cur_err = errors[3];
      const householdID = nanoid();
      await Households.insert({ id: householdID });

      cur_err = errors[4];
      let member = await Members.insert({
        username,
        email: confirmation.email,
        password: bcrypt.hashSync(password, 10),
        current_household: householdID,
      });

      AccountConfirmations.remove(confirmation.email).then(() => {
        const token = generateToken(member);
        res.status(200).json({
          message: `Welcome, ${member.email}`,
          token,
          member_id: member.id,
          username: member.username,
        });
      });
      // no catch statement necessary
    } catch (e) {
      e && console.log(e);
      res.status(cur_err.status).json({ message: cur_err.message });
    }
  } else {
    res.status(cur_err.status).json({ message: cur_err.message });
  }
});

router.post('/forgot', (req, res) => {
  const { email } = req.body;
  if (email) {
    Members.getByEmail(email).then((member) => {
      if (member) {
        // remove previous attempts
        PasswordConfirmations.remove(member.id).then(() => {
          const newConfirmation = {
            member_id: member.id,
            id: nanoid(),
          };
          PasswordConfirmations.insert(newConfirmation)
            .then(({ id }) => {
              sendMail(member.email, templates.reset(id))
                .then(() => {
                  res.status(200).json({
                    message: 'A password reset link has been sent',
                    email: member.email,
                  });
                })
                .catch(() => {
                  res
                    .status(500)
                    .json({ message: 'Email service failed to send' });
                });
            })
            .catch((e) => {
              console.log(e);
              res.status(500).json({
                message:
                  'Failed to store confirmation information in the database',
              });
            });
        });
      } else {
        res
          .status(404)
          .json({ message: 'A User with that email address does not exist.' });
      }
    });
  } else {
    res.status(400).json({ message: 'Request body missing email' });
  }
});

router.post('/reset', (req, res) => {
  const { hash, password } = req.body;
  if (hash && password) {
    PasswordConfirmations.getById(hash).then((confirmation) => {
      if (confirmation) {
        const member_id = confirmation.member_id;
        const newPassword = bcrypt.hashSync(password, 10);
        Members.update(member_id, { password: newPassword })
          .then(() => {
            PasswordConfirmations.remove(hash).then((rem) => {
              console.log(rem);
              res
                .status(200)
                .json({ message: 'Your password has been reset.' });
            });
          })
          .catch(() => {
            res.status(500).json({ message: 'Member to update not found' });
          });
      } else {
        res.status(404).json({ message: 'Invalid confirmation hash' });
      }
    });
  } else {
    res.status(400).json({ message: 'Request body missing hash or password' });
  }
});

module.exports = router;

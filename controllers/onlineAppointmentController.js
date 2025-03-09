const ApiError = require('../error/ApiError');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const moment = require('moment');
require('moment/locale/ru');
const {
  Invites,
  UserBranch,
  User,
  Branch,
  Tenant,
  Procedure,
  DoctorProcedure,
  Doctor,
  Reception,
  Position,
  Schedule,
  Client,
  ReceptionProcedure,
  ClientAbonement,
  Break,
  ServicesGroup,
} = require('../models/models');
const { Op } = require('sequelize');
const MailSending = require('../utils/mail');
const { model } = require('../db');
const axios = require('axios');
const DateFns = require('date-fns');

const getDateTimeForEmployeeFunction = async (
  servicesIds,
  employee,
  branch,
  appointmentStepMinutes,
) => {
  moment.locale('ru');

  const afterThreeMonths = moment()
    .add(branch.timezone + 90 * 24, 'hours')
    .toDate();

  const startSearchDate = moment()
    .subtract(24 - branch.timezone, 'hours')
    .toDate();

  const records = await Reception.findAll({
    where: {
      doctorId: employee.id,
      branchId: branch.id,
      date: {
        [Op.gt]: startSearchDate,
        [Op.lt]: afterThreeMonths,
      },
    },
  });

  const breaks = await Break.findAll({
    where: {
      date: {
        [Op.gt]: startSearchDate,
        [Op.lt]: afterThreeMonths,
      },
      doctorId: employee.id,
      branchId: branch.id,
    },
  });

  const days = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];

  const services = await Promise.all(
    servicesIds.map(async service_id => {
      const service = await Procedure.findOne({ where: { id: service_id, branchId: branch.id } });
      return service;
    }),
  );

  const serviceDuration = services.reduce((accum, item) => accum + item.duration, 0);

  const daysOfWeek = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const daysOfWeekCap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  let dayFound = false;

  for (let i = 0; i < 90; i++) {
    const currentDate = moment().add(branch.timezone, 'hours').toDate();
    currentDate.setDate(currentDate.getDate() + i);

    const dayOfWeek = daysOfWeek[currentDate.getDay()];
    const dayOfWeekCap = daysOfWeekCap[currentDate.getDay()];
    let openingTime = new Date(currentDate);
    const closingTime = new Date(currentDate);

    if (
      !branch[`is${dayOfWeekCap}`] ||
      (employee.schedule && !employee.schedule[`is${dayOfWeekCap}`])
    ) {
      continue;
    }

    if (!employee.schedule || branch[`${dayOfWeek}From`] >= employee.schedule[`${dayOfWeek}From`]) {
      openingTime.setHours(branch[`${dayOfWeek}From`].slice(0, 2));
      openingTime.setMinutes(branch[`${dayOfWeek}From`].slice(3, 5));
    } else if (branch[`${dayOfWeek}From`] < employee.schedule[`${dayOfWeek}From`]) {
      openingTime.setHours(employee.schedule[`${dayOfWeek}From`].slice(0, 2));
      openingTime.setMinutes(employee.schedule[`${dayOfWeek}From`].slice(3, 5));
    }

    if (!employee.schedule || branch[`${dayOfWeek}To`] <= employee.schedule[`${dayOfWeek}To`]) {
      closingTime.setHours(branch[`${dayOfWeek}To`].slice(0, 2));
      closingTime.setMinutes(branch[`${dayOfWeek}To`].slice(3, 5));
    } else if (branch[`${dayOfWeek}To`] > employee.schedule[`${dayOfWeek}To`]) {
      closingTime.setHours(employee.schedule[`${dayOfWeek}To`].slice(0, 2));
      closingTime.setMinutes(employee.schedule[`${dayOfWeek}To`].slice(3, 5));
    }
    closingTime.setMinutes(closingTime.getMinutes());

    openingTime.setSeconds(0);
    closingTime.setSeconds(0);

    const availableTimes = [];

    const existingAppointments = records.filter(
      record =>
        record.date ===
        currentDate.toLocaleString('en-GB').slice(6, 10) +
          '-' +
          currentDate.toLocaleString('en-GB').slice(3, 5) +
          '-' +
          currentDate.toLocaleString('en-GB').slice(0, 2),
    );

    const today_gmt = moment();
    const today_timezone = today_gmt.add(branch.timezone, 'hours');
    const today = today_timezone.toDate();
    if (currentDate.getDate() === today.getDate() && currentDate.getMonth() === today.getMonth()) {
      if (openingTime < today) {
        openingTime = today;
        openingTime.setMinutes(openingTime.getMinutes() + appointmentStepMinutes || 30);
        openingTime.setMinutes(0, 0, 0);
        openingTime.setSeconds(0);
      }
    }

    const breaksToday = breaks?.filter(breakInfo => {
      const currentDateFormatted = moment(currentDate).format('YYYY-MM-DD');
      return breakInfo?.date === currentDateFormatted;
    });

    for (
      let time = new Date(openingTime);
      time < closingTime;
      time.setMinutes(time.getMinutes() + appointmentStepMinutes || 30)
    ) {
      const endTime = new Date(time);
      endTime.setMinutes(time.getMinutes() + serviceDuration);
      time.setSeconds(0);
      endTime.setSeconds(0);

      const breakWhenTime = breaksToday.find(breakElement => {
        const receptionTime = moment(time);
        const receptionEndTime = moment(endTime);
        const breakTime = moment(breakElement.time, 'HH:mm:ss');
        const breakEndTime = moment(breakElement.endTime, 'HH:mm:ss');

        receptionTime.set({ year: 1970, month: 0, date: 1 });
        receptionEndTime.set({ year: 1970, month: 0, date: 1 });
        breakTime.set({ year: 1970, month: 0, date: 1 });
        breakEndTime.set({ year: 1970, month: 0, date: 1 });

        const isBreakDuringReception =
          (breakTime.isSameOrAfter(receptionTime) && breakTime.isBefore(receptionEndTime)) ||
          (breakEndTime.isAfter(receptionTime) && breakEndTime.isSameOrBefore(receptionEndTime)) ||
          (breakTime.isBefore(receptionTime) && breakEndTime.isAfter(receptionEndTime));

        return isBreakDuringReception
      })

      if (breakWhenTime) continue

      const endTimeMinusOneMinute = new Date(endTime);
      endTimeMinusOneMinute.setMinutes(endTime.getMinutes() - 1);

      const timePlusOneMinute = new Date(time);
      timePlusOneMinute.setMinutes(time.getMinutes() + 1);

      if (
        time >= openingTime &&
        endTimeMinusOneMinute <= closingTime &&
        !existingAppointments.some(
          record =>
            (time.toLocaleTimeString('en-GB').slice(0, 5) >= record.time.slice(0, 5) &&
              time.toLocaleTimeString('en-GB').slice(0, 5) < record.endTime.slice(0, 5)) ||
            (endTime.toLocaleTimeString('en-GB').slice(0, 5) > record.time.slice(0, 5) &&
              endTime.toLocaleTimeString('en-GB').slice(0, 5) <= record.endTime.slice(0, 5)) ||
            (time.toLocaleTimeString('en-GB').slice(0, 5) <= record.time.slice(0, 5) &&
              endTime.toLocaleTimeString('en-GB').slice(0, 5) >= record.endTime.slice(0, 5)),
        )
      ) {
        availableTimes.push(
          time.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
        );
        dayFound = true;
      }
    }

    if (dayFound) {
      const morningTime = availableTimes.filter(time => time < '12:00');
      const dayTime = availableTimes.filter(time => time >= '12:00' && time < '18:00');
      const eveningTime = availableTimes.filter(time => time >= '18:00');

      return {
        date: moment(currentDate).format('YYYY-MM-DD'),
        dateString: moment(currentDate).format('dddd, D MMMM'),
        morningTime,
        dayTime,
        eveningTime,
        serviceDuration,
      };
    }
  }
  return undefined;
};

class onlineAppointmentController {
  async createWidget(req, res, next) {
    try {
      const { id } = req.params;
      return res.send(
        `
    const button = document.createElement('button');
    button.className='clyconButton';
    button.innerHTML = 'Онлайн-запись';
    button.style.zIndex = 999;

    const closeButton = document.createElement('button');
    closeButton.className='clyconCloseIframeButton';
    closeButton.innerHTML = '✕';

    const bg = document.createElement('div');
    bg.className = 'clyconWidgetBackground';
    bg.id = 'clyconWidgetBackground';
    bg.classList.add('clyconWidgetBackgroundHidden');

    const clyconIFrame = document.createElement('iframe');
    clyconIFrame.src="https://app.clycon.com/widget/${id}";
    clyconIFrame.sandbox.add('allow-same-origin');
    clyconIFrame.sandbox.add('allow-top-navigation');
    clyconIFrame.sandbox.add('allow-forms');
    clyconIFrame.sandbox.add('allow-scripts');
    clyconIFrame.style.width = '600px';
    clyconIFrame.style.height = '100vh';
    clyconIFrame.style.border = 'none';
    clyconIFrame.classList.add('clyconWidgetIFrame');
    clyconIFrame.classList.add('clyconWidgetIFrameHidden');

    bg.appendChild(clyconIFrame);
    bg.appendChild(closeButton);

    document.body.appendChild(bg);
    document.body.appendChild(button);

    var cssId = 'clyconCss';
    if (!document.getElementById(cssId))
    {
        var head  = document.getElementsByTagName('head')[0];
        var link  = document.createElement('link');
        link.id   = cssId;
        link.rel  = 'stylesheet';
        link.type = 'text/css';
        link.href = 'https://api.clycon.com/static/clyconWidget.css';
        link.media = 'all';
        head.appendChild(link);
    }

    button.addEventListener("click", () => {
      if(window.screen.width >= 600){
        bg.classList.remove('clyconWidgetBackgroundHidden');
        clyconIFrame.classList.remove('clyconWidgetIFrameHidden');
      } else {
        window.open('https://app.clycon.com/widget/${id}');
      }
    }, false);

    const clyconButtons = document.querySelectorAll('.clycon_widget_button');

    if(clyconButtons && clyconButtons.length){
      clyconButtons.forEach((clyconButtonElement) => {
        clyconButtonElement.addEventListener('click', () => {
          if(window.screen.width >= 600){
            bg.classList.remove('clyconWidgetBackgroundHidden');
            clyconIFrame.classList.remove('clyconWidgetIFrameHidden');
          } else {
            window.open('https://app.clycon.com/widget/${id}');
          }
        }, false);
      })
    }

    bg.addEventListener("click", () => {
      bg.classList.add('clyconWidgetBackgroundHidden');
      clyconIFrame.classList.add('clyconWidgetIFrameHidden');
      clyconIFrame.src = "https://app.clycon.com/widget/${id}";
  }, false);
`,
      );
    } catch (e) {
      next(ApiError.badRequest(e.message));
    }
  }

  async getBranches(req, res, next) {
    try {
      const { tenantId } = req.query;
      if (!tenantId) {
        return next(
          ApiError.badRequest('01120001 | Произошла ошибка. Не передан идентификатор компании'),
        );
      }

      const tenant = await Tenant.findOne({ where: { id: tenantId } });

      if (!tenant) {
        return next(
          ApiError.badRequest('01120003 | Произошла ошибка. Такой компании не существует'),
        );
      }

      const branches = await Branch.findAll({
        where: { tenantId },
        attributes: ['id', 'name', 'city', 'street', 'lat', 'lon', 'mapImgUrl'],
      });

      if (!branches || !branches.length) {
        return next(ApiError.badRequest('01120003 | Произошла ошибка. У компании нет филиалов'));
      }

      moment.locale('ru');

      if (branches.length === 1) {
        const branch = branches[0];
        const services = await Procedure.findAll({
          where: { branchId: branch.id, is_online_appointment: true },
          include: [
            {
              model: DoctorProcedure,
              required: true,
              where: { procedureId: { [Op.col]: 'procedure.id' }, branchId: branch.id },
              attributes: ['doctorId'],
            },
          ],
        });
        if (services && services.length) {
          return res.status(200).json({ tenant, branches, services });
        } else {
          return next(
            ApiError.badRequest(
              '01120003 | Произошла ошибка. У филиала нет доступных для выбора процедур. Это может быть связано с тем, что услуги не привязаны к специалистам. Привязать услуги можно в карточке специалиста.',
            ),
          );
        }
      } else {
        const non_empty_branches = [];

        await Promise.all(
          branches.map(async branch => {
            const services = await Procedure.findAll({
              where: { branchId: branch.id, is_online_appointment: true },
              include: [
                {
                  model: DoctorProcedure,
                  required: true,
                  where: { procedureId: { [Op.col]: 'procedure.id' }, branchId: branch.id },
                  attributes: ['doctorId'],
                },
              ],
            });
            if (services && services.length) {
              non_empty_branches.push(branch);
            }
          }),
        );
        return res.status(200).json({ tenant, branches: non_empty_branches });
      }
    } catch (e) {
      next(ApiError.badRequest(e.message));
    }
  }

  async getServices(req, res, next) {
    try {
      const { tenantId, branchId } = req.query;
      if (!tenantId || !branchId) {
        return next(
          ApiError.badRequest(
            '01120001 | Произошла ошибка. Не передан идентификатор компании или филиала.',
          ),
        );
      }
  
      // 1. Получаем данные арендатора
      const tenant = await Tenant.findOne({ where: { id: tenantId } });
  
      if (!tenant) {
        return next(
          ApiError.badRequest('01120003 | Произошла ошибка. Такой компании не существует'),
        );
      }
  
      // 2. Получаем данные филиала
      const branch = await Branch.findOne({
        where: { tenantId, id: branchId },
      });
  
      if (!branch) {
        return next(
          ApiError.badRequest('01120003 | Произошла ошибка. Такого филиала не существует.'),
        );
      }
  
      // 3. Получаем услуги без группы
      const ungroupedServices = await Procedure.findAll({
        where: {
          branchId,
          groupId: null,
          is_online_appointment: true,
        },
        include: [
          {
            model: DoctorProcedure,
            required: true,
            where: { procedureId: { [Op.col]: 'procedure.id' }, branchId },
            attributes: ['doctorId'],
          },
        ],
      });
  
      // 4. Получаем группы с вложенными услугами
      const groups = await ServicesGroup.findAll({
        where: { branchId },
        include: [
          {
            model: Procedure,
            as: 'procedures',
            where: {
              is_online_appointment: true,
            },
            include: [
              {
                model: DoctorProcedure,
                required: true,
                where: { procedureId: { [Op.col]: 'procedures.id' }, branchId },
                attributes: ['doctorId'],
              },
            ],
          },
        ],
      });
  
      // Проверяем, есть ли услуги
      const hasServices =
        (ungroupedServices && ungroupedServices.length > 0) ||
        (groups && groups.length > 0 && groups.some((group) => group.procedures.length > 0));
  
      if (hasServices) {
        return res.json({
          tenant,
          branch,
          services: {
            ungroupedServices,
            groups,
          },
        });
      } else {
        return next(
          ApiError.badRequest(
            '01120003 | Произошла ошибка. У филиала нет доступных для выбора процедур. Это может быть связано с тем, что услуги не привязаны к специалистам. Привязать услуги можно в карточке специалиста.',
          ),
        );
      }
    } catch (e) {
      next(ApiError.badRequest(e.message));
    }
  }
  

  async getEmployees(req, res, next) {
    try {
      const { tenantId, branchId, services } = req.query;

      if (!tenantId || !branchId || !services || !services.length) {
        return next(
          ApiError.badRequest(
            '01120001 | Произошла ошибка. Не передан идентификатор компании, филиала или процедуры.',
          ),
        );
      }

      const tenant = await Tenant.findOne({ where: { id: tenantId } });

      if (!tenant) {
        return next(
          ApiError.badRequest('01120003 | Произошла ошибка. Такой компании не существует'),
        );
      }

      moment.locale('ru');

      const branch = await Branch.findOne({
        where: { id: branchId, tenantId },
      });

      if (!branch) {
        return next(
          ApiError.badRequest('01120003 | Произошла ошибка. Такого филиала не существует.'),
        );
      }

      for (let service_id of services) {
        const service = await Procedure.findOne({ where: { id: service_id, branchId } });
        if (!service) {
          return next(
            ApiError.badRequest('01120003 | Произошла ошибка. Такой услуги не существует.'),
          );
        }
      }

      // Если выбрана только одна услуга, достаточно найти специалистов, оказывающих её и все

      if (services.length === 1) {
        const employeeService = await DoctorProcedure.findAll({
          where: { procedureId: services[0], branchId },
          attributes: ['doctorId'],
        });

        const employees = await Promise.all(
          employeeService.map(async es => {
            const doctor = await Doctor.findOne({
              where: { id: es.doctorId, branchId },
              attributes: ['id', 'surname', 'first_name', 'middle_name'],
              include: [
                {
                  model: Position,
                  required: false,
                  attributes: ['name'],
                  where: { id: { [Op.col]: 'positionId' }, branchId },
                },
                { model: Schedule, required: false },
              ],
            });
            return doctor;
          }),
        );

        if (!employees || !employees.length) {
          return next(
            ApiError.badRequest(
              '01120003 | Произошла ошибка. Ни один специалист не оказывает данную услугу.',
            ),
          );
        }

        const employeesTime = await Promise.all(
          employees.map(async employee => {
            const time = await getDateTimeForEmployeeFunction(
              services,
              employee,
              branch,
              tenant?.appointmentStepMinutes,
            );
            return time;
          }),
        );

        return res.json({ tenant, branch, services, employees, employeesTime });
      }

      // Если выбранных услуг несколько, необходимо найти специалиста, оказывающего все эти услуги

      // поиск сотрудников, оказывающих услуги из списка
      const employeeServices = await Promise.all(
        services.map(async service_id => {
          const employeeService = await DoctorProcedure.findAll({
            where: { procedureId: service_id, branchId },
            attributes: ['doctorId'],
          });
          return employeeService;
        }),
      );

      // превращение [[{doctor_id: 1}, {doctor_id: 3}], [{doctor_id: 1}, {doctor_id: 2}]]
      // в [[1, 3], [1, 2]]
      const employeeServicesId = employeeServices.map(es => {
        const arr = es.map(object => object.doctorId);
        return arr;
      });

      // функция поиска пересечения в нескольких массивах
      const intersect = (first = [], ...rest) => {
        rest = rest.map(array => new Set(array));
        return first.filter(e => rest.every(set => set.has(e)));
      };

      // массив id, которые есть в каждом массиве
      const employees_id = intersect(...employeeServicesId);

      // проверка на пустоту массива - нет сотрудников, которые делают все 3 процедуры
      if (!employees_id || !employees_id.length) {
        return next(
          ApiError.badRequest(
            '01120003 | Произошла ошибка. Ни один специалист не оказывает данную услугу.',
          ),
        );
      }

      // получение информации о сотрудниках
      const employees = await Promise.all(
        employees_id.map(async id => {
          const employee = await Doctor.findOne({
            where: { id, branchId },
            attributes: ['id', 'surname', 'positionId', 'first_name', 'middle_name'],
            include: [
              {
                model: Position,
                required: false,
                attributes: ['name'],
                where: { id: { [Op.col]: 'positionId' }, branchId },
              },
              { model: Schedule, required: false },
            ],
          });
          return employee;
        }),
      );

      const employeesTime = await Promise.all(
        employees.map(async employee => {
          const time = await getDateTimeForEmployeeFunction(
            services,
            employee,
            branch,
            tenant?.appointmentStepMinutes,
          );
          return time;
        }),
      );

      return res.json({ tenant, branch, services, employees, employeesTime });
    } catch (e) {
      next(ApiError.badRequest(e.message));
    }
  }

  async getDateTime(req, res, next) {
    try {
      const { tenantId, branchId, services, employee } = req.query;
      if (!tenantId || !branchId || !employee || !services || !services.length) {
        return next(
          ApiError.badRequest(
            '01120001 | Произошла ошибка. Не передан идентификатор компании, филиала или процедуры.',
          ),
        );
      }

      const tenant = await Tenant.findOne({ where: { id: tenantId } });

      if (!tenant) {
        return next(
          ApiError.badRequest('01120003 | Произошла ошибка. Такой компании не существует'),
        );
      }

      const branch = await Branch.findOne({
        where: { id: branchId, tenantId },
      });

      moment.locale('ru');

      const employeeInfo = await Doctor.findOne({
        where: { id: employee, branchId },
        include: [
          { model: Schedule, required: false },
          {
            model: Position,
            required: false,
            attributes: ['name'],
            where: { id: { [Op.col]: 'positionId' }, branchId },
          },
        ],
      });

      if (!branch) {
        return next(
          ApiError.badRequest('01120003 | Произошла ошибка. Такого филиала не существует.'),
        );
      }

      if (!employeeInfo) {
        return next(
          ApiError.badRequest('01120003 | Произошла ошибка. Такого сотрудника не существует.'),
        );
      }

      for (let service_object of services) {
        const service = await Procedure.findOne({ where: { id: service_object, branchId } });
        if (!service) {
          return next(
            ApiError.badRequest('01120003 | Произошла ошибка. Такой услуги не существует.'),
          );
        }
      }

      const afterThreeMonths = moment()
        .add(branch.timezone + 90 * 24, 'hours')
        .toDate();

      const startSearchDate = moment()
        .subtract(24 - branch.timezone, 'hours')
        .toDate();

      const records = await Reception.findAll({
        where: {
          doctorId: employee,
          branchId: branch.id,
          date: {
            [Op.gt]: startSearchDate,
            [Op.lt]: afterThreeMonths,
          },
        },
      });
      const breaks = await Break.findAll({
        where: {
          date: {
            [Op.gt]: startSearchDate,
            [Op.lt]: afterThreeMonths,
          },
          doctorId: employee,
          branchId: branch.id,
        },
      });

      const days = [
        'воскресенье',
        'понедельник',
        'вторник',
        'среда',
        'четверг',
        'пятница',
        'суббота',
      ];

      const services_full = await Promise.all(
        services.map(async service_id => {
          const service = await Procedure.findOne({
            where: { id: service_id, branchId: branch.id },
          });
          return service;
        }),
      );

      // TO-DO: вычислять суммарное время приемов
      const serviceDuration = services_full.reduce((accum, item) => accum + item.duration, 0);

      const daysOfWeek = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
      const daysOfWeekCap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const schedule = [];

      for (let i = 0; i < 90; i++) {
        const currentDate = moment().add(branch.timezone, 'hours').toDate();
        currentDate.setDate(currentDate.getDate() + i);

        const dayOfWeek = daysOfWeek[currentDate.getDay()];
        const dayOfWeekCap = daysOfWeekCap[currentDate.getDay()];
        let openingTime = new Date(currentDate);
        const closingTime = new Date(currentDate);

        if (
          !branch[`is${dayOfWeekCap}`] ||
          (employeeInfo.schedule && !employeeInfo.schedule[`is${dayOfWeekCap}`])
        ) {
          const morningTime = [];
          const dayTime = [];
          const eveningTime = [];
          const stringDate = currentDate
            .toLocaleDateString('ru-RU', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })
            .split(' ');
          let isActive = false;
          schedule.push({
            date: moment(currentDate).format('YYYY-MM-DD'),
            dateString:
              stringDate[0] + ' ' + stringDate[1] + ' (' + days[currentDate.getDay()] + ')',
            morningTime,
            dayTime,
            eveningTime,
            serviceDuration,
            isActive,
          });
          continue;
        }

        if (
          !employeeInfo.schedule ||
          branch[`${dayOfWeek}From`] >= employeeInfo.schedule[`${dayOfWeek}From`]
        ) {
          openingTime.setHours(branch[`${dayOfWeek}From`].slice(0, 2));
          openingTime.setMinutes(branch[`${dayOfWeek}From`].slice(3, 5));
        } else if (branch[`${dayOfWeek}From`] < employeeInfo.schedule[`${dayOfWeek}From`]) {
          openingTime.setHours(employeeInfo.schedule[`${dayOfWeek}From`].slice(0, 2));
          openingTime.setMinutes(employeeInfo.schedule[`${dayOfWeek}From`].slice(3, 5));
        }

        if (
          !employeeInfo.schedule ||
          branch[`${dayOfWeek}To`] <= employeeInfo.schedule[`${dayOfWeek}To`]
        ) {
          closingTime.setHours(branch[`${dayOfWeek}To`].slice(0, 2));
          closingTime.setMinutes(branch[`${dayOfWeek}To`].slice(3, 5));
        } else if (branch[`${dayOfWeek}To`] > employeeInfo.schedule[`${dayOfWeek}To`]) {
          closingTime.setHours(employeeInfo.schedule[`${dayOfWeek}To`].slice(0, 2));
          closingTime.setMinutes(employeeInfo.schedule[`${dayOfWeek}To`].slice(3, 5));
        }
        closingTime.setMinutes(closingTime.getMinutes());

        openingTime.setSeconds(0);
        closingTime.setSeconds(0);

        const availableTimes = [];

        const existingAppointments = records.filter(
          record =>
            record.date ===
            currentDate.toLocaleString('en-GB').slice(6, 10) +
              '-' +
              currentDate.toLocaleString('en-GB').slice(3, 5) +
              '-' +
              currentDate.toLocaleString('en-GB').slice(0, 2),
        );

        const today_gmt = moment().tz('GMT');
        const today_timezone = today_gmt.add(branch.timezone, 'hours');
        const today = today_timezone.toDate();
        if (
          currentDate.getDate() === today.getDate() &&
          currentDate.getMonth() === today.getMonth()
        ) {
          if (openingTime < today) {
            openingTime = today;
            openingTime.setMinutes(openingTime.getMinutes() + tenant?.appointmentStepMinutes || 30);
            openingTime.setMinutes(0, 0, 0);
            openingTime.setSeconds(0);
          }
        }

        const breaksToday = breaks?.filter(breakInfo => {
          const currentDateFormatted = moment(currentDate).format('YYYY-MM-DD');
          return breakInfo?.date === currentDateFormatted;
        });

        for (
          let time = new Date(openingTime);
          time < closingTime;
          time.setMinutes(time.getMinutes() + tenant?.appointmentStepMinutes || 30)
        ) {
          const endTime = new Date(time);
          endTime.setMinutes(time.getMinutes() + serviceDuration);

          time.setSeconds(0);
          endTime.setSeconds(0);
          //BUG: Есть какая-то проблема со сравниванием времени, а именно при сравнивании времени конца рабочего дня с endTime и конца приема с time. Это странно

          const breakWhenTime = breaksToday.find(breakElement => {
            const receptionTime = moment(time);
            const receptionEndTime = moment(endTime);
            const breakTime = moment(breakElement.time, 'HH:mm:ss');
            const breakEndTime = moment(breakElement.endTime, 'HH:mm:ss');

            receptionTime.set({ year: 1970, month: 0, date: 1 });
            receptionEndTime.set({ year: 1970, month: 0, date: 1 });
            breakTime.set({ year: 1970, month: 0, date: 1 });
            breakEndTime.set({ year: 1970, month: 0, date: 1 });

            const isBreakDuringReception =
              (breakTime.isSameOrAfter(receptionTime) && breakTime.isBefore(receptionEndTime)) ||
              (breakEndTime.isAfter(receptionTime) && breakEndTime.isSameOrBefore(receptionEndTime)) ||
              (breakTime.isBefore(receptionTime) && breakEndTime.isAfter(receptionEndTime));

            return isBreakDuringReception
          })

          if (breakWhenTime) continue

          const endTimeMinusOneMinute = new Date(endTime);
          endTimeMinusOneMinute.setMinutes(endTime.getMinutes() - 1);

          const timePlusOneMinute = new Date(time);
          timePlusOneMinute.setMinutes(time.getMinutes() + 1);

          if (
            time >= openingTime &&
            endTimeMinusOneMinute <= closingTime &&
            !existingAppointments.some(
              record =>
                (time.toLocaleTimeString('en-GB').slice(0, 5) >= record.time.slice(0, 5) &&
                  time.toLocaleTimeString('en-GB').slice(0, 5) < record.endTime.slice(0, 5)) ||
                (endTime.toLocaleTimeString('en-GB').slice(0, 5) > record.time.slice(0, 5) &&
                  endTime.toLocaleTimeString('en-GB').slice(0, 5) <= record.endTime.slice(0, 5)) ||
                (time.toLocaleTimeString('en-GB').slice(0, 5) <= record.time.slice(0, 5) &&
                  endTime.toLocaleTimeString('en-GB').slice(0, 5) >= record.endTime.slice(0, 5)),
            )
          ) {
            availableTimes.push(
              time.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
            );
          }
        }

        const stringDate = currentDate
          .toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })
          .split(' ');

        const morningTime = availableTimes.filter(time => time < '12:00');
        const dayTime = availableTimes.filter(time => time >= '12:00' && time < '18:00');
        const eveningTime = availableTimes.filter(time => time >= '18:00');

        let isActive = true;

        if (!morningTime.length && !dayTime.length && !eveningTime.length) {
          isActive = false;
        }

        schedule.push({
          date: moment(currentDate).format('YYYY-MM-DD'),
          dateString: stringDate[0] + ' ' + stringDate[1] + ' (' + days[currentDate.getDay()] + ')',
          morningTime,
          dayTime,
          eveningTime,
          serviceDuration,
          isActive,
        });
      }

      // дополняем дни до понедельника

      const today_gmt = moment().tz('GMT');
      const today_timezone = today_gmt.add(branch.timezone, 'hours');
      const today = today_timezone.toDate();
      if (today.getDay() != 1) {
        for (let i = 1; i < today.getDay(); i++) {
          const fakeDate = new Date(today);
          fakeDate.setDate(today.getDate() - i);
          const stringDate = fakeDate
            .toLocaleDateString('ru-RU', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })
            .split(' ');
          const isActive = false;
          const morningTime = [];
          const dayTime = [];
          const eveningTime = [];
          schedule.unshift({
            date: moment(fakeDate).format('YYYY-MM-DD'),
            dateString: stringDate[0] + ' ' + stringDate[1] + ' (' + days[fakeDate.getDay()] + ')',
            morningTime,
            dayTime,
            eveningTime,
            serviceDuration,
            isActive,
          });
        }
      }

      //const lastDateString = schedule[schedule.length -1].date.split(".")
      const lastDate = new Date(schedule[schedule.length - 1].date);
      if (lastDate.getDay() != 0) {
        for (let i = 1; i <= 7 - lastDate.getDay(); i++) {
          const fakeDate = new Date(lastDate);
          fakeDate.setDate(lastDate.getDate() + i);
          const stringDate = fakeDate
            .toLocaleDateString('ru-RU', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })
            .split(' ');
          const isActive = false;
          const morningTime = [];
          const dayTime = [];
          const eveningTime = [];
          schedule.push({
            date: moment(fakeDate).format('YYYY-MM-DD'),
            dateString: stringDate[0] + ' ' + stringDate[1] + ' (' + days[fakeDate.getDay()] + ')',
            morningTime,
            dayTime,
            eveningTime,
            serviceDuration,
            isActive,
          });
        }
      }

      return res.json({
        tenant,
        branch,
        services: services_full,
        employee: employeeInfo,
        schedule: schedule,
      });
    } catch (e) {
      next(ApiError.badRequest(e.message));
    }
  }

  async createReception(req, res, next) {
    try {
      const {
        tenantId,
        branchId,
        surname,
        first_name,
        middle_name,
        phone,
        mail,
        note,
        employeeId,
        date,
        time,
        endTime,
        services,
        is_widget_appointment,
        sendEmailFor,
        polisOMS,
        polisOMSnumber,
        caretaker,
      } = req.body;
      if (
        !tenantId ||
        !branchId ||
        !first_name ||
        !phone ||
        !employeeId ||
        !date ||
        !time ||
        !endTime ||
        !services ||
        !services.length ||
        !is_widget_appointment
      ) {
        return next(
          ApiError.badRequest('01120001 | Произошла ошибка. Не переданы необходимые поля.'),
        );
      }

      const branch = await Branch.findOne({
        where: { id: branchId, tenantId },
      });

      const employeeInfo = await Doctor.findOne({
        where: { id: employeeId, branchId },
      });

      if (!branch) {
        return next(
          ApiError.badRequest('01120003 | Произошла ошибка. Такого филиала не существует.'),
        );
      }

      if (!employeeInfo) {
        return next(
          ApiError.badRequest('01120003 | Произошла ошибка. Такого сотрудника не существует.'),
        );
      }

      let client = await Client.findOne({
        where: { phone, branchId },
        include: [
          {
            model: ClientAbonement,
            as: 'activeAbonement',
            required: false,
          },
        ],
      });

      if (!client) {
        client = await Client.create({
          surname,
          first_name,
          middle_name,
          phone,
          branchId,
          mail,
          caretaker,
        });
      }

      //TODO: Убрать нахуй polisOMS
      const reception = await Reception.create({
        date,
        time,
        endTime,
        clientId: client.id,
        doctorId: employeeInfo.id,
        note,
        branchId,
        is_widget_appointment,
        polisOMS: polisOMSnumber,
      });

      const servicesList = [];
      services.map(async service => {
        servicesList.push(service.name);
        await ReceptionProcedure.create({
          receptionId: reception.id,
          procedureId: service.id,
          branchId,
        });
      });

      if (client.mail || mail) {
        let mail_to_send = '';
        if (client.mail) {
          mail_to_send = client.mail;
        } else {
          mail_to_send = mail;
        }

        MailSending.NewReceptionMail(
          `${mail_to_send}`,
          `${client.first_name} ${client.middle_name}`,
          `${branch.name}`,
          `${branch.city}`,
          `${branch.street}`,
          `${employeeInfo.surname} ${employeeInfo.first_name} ${employeeInfo.middle_name}`,
          servicesList,
          `${date}`,
          `${time}`,
          `${endTime}`,
        );

        if (employeeInfo.mail) {
          MailSending.NewReceptionMailForDoctor(
            `${employeeInfo.mail}`,
            `${employeeInfo.first_name} ${employeeInfo.middle_name}`,
            `${branch.name}`,
            `${branch.city}`,
            `${branch.street}`,
            `${client.surname} ${client.first_name} ${client.middle_name}`,
            proceduresList,
            `${date}`,
            `${time}`,
            `${endTime}`,
          );
        }

        const now_GMT00 = new Date();
        const receptionDateTime_GMT00 = DateFns.subHours(
          DateFns.parse(`${date} ${time}`, 'yyyy-MM-dd HH:mm', new Date()),
          Number(branch.timezone),
        );

        const now_TIMEZONE = DateFns.addHours(now_GMT00, Number(branch.timezone));
        const receptionDateTime_TIMEZONE = DateFns.addHours(
          receptionDateTime_GMT00,
          Number(branch.timezone),
        );

        const hoursToReception = DateFns.differenceInHours(
          receptionDateTime_TIMEZONE,
          now_TIMEZONE,
        );
        const emailTime_GMT00 = DateFns.subHours(receptionDateTime_GMT00, sendEmailFor);

        // console.log(now_GMT00);
        // console.log(now_TIMEZONE);
        // console.log(receptionDateTime_GMT00);
        // console.log(receptionDateTime_TIMEZONE);
        // console.log(hoursToReception);
        // console.log(emailTime_GMT00);

        if (sendEmailFor && hoursToReception > sendEmailFor) {
          try {
            await axios.post(process.env.NOTIFICATIONS_SERVICE_URL, {
              emailTimeGMT00: emailTime_GMT00,
              branchTimezone: Number(branch.timezone),
              receptionId: reception.id,

              clientMail: mail_to_send,
              clientName: `${client.first_name} ${client.middle_name}`,
              company: branch.name,
              branchCity: branch.city,
              branchAddress: branch.street,
              doctorName: `${employeeInfo.surname} ${employeeInfo.first_name} ${employeeInfo.middle_name}`,
              servicesList: JSON.stringify(servicesList),
              date,
              time,
              endTime,
            });
          } catch (e) {
            console.error(e);
          }
        }
      }

      return res.json(reception);
    } catch (e) {
      next(ApiError.badRequest(e.message));
    }
  }

  async getSummary(req, res, next) {
    try {
      const { tenantId, branchId, services, employee, date } = req.query;
      if (!tenantId || !branchId || !employee || !services || !services.length || !date) {
        return next(
          ApiError.badRequest(
            '01120001 | Произошла ошибка. Не передан идентификатор компании, филиала или процедуры.',
          ),
        );
      }

      const tenant = await Tenant.findOne({ where: { id: tenantId } });

      if (!tenant) {
        return next(
          ApiError.badRequest('01120003 | Произошла ошибка. Такой компании не существует'),
        );
      }

      const branch = await Branch.findOne({
        where: { id: branchId, tenantId },
      });

      moment.locale('ru');

      const employeeInfo = await Doctor.findOne({
        where: { id: employee, branchId },
        include: [
          {
            model: Position,
            required: false,
            attributes: ['name'],
            where: { id: { [Op.col]: 'positionId' }, branchId },
          },
        ],
      });

      if (!branch) {
        return next(
          ApiError.badRequest('01120003 | Произошла ошибка. Такого филиала не существует.'),
        );
      }

      if (!employeeInfo) {
        return next(
          ApiError.badRequest('01120003 | Произошла ошибка. Такого сотрудника не существует.'),
        );
      }

      for (let service_object of services) {
        const service = await Procedure.findOne({ where: { id: service_object, branchId } });
        if (!service) {
          return next(
            ApiError.badRequest('01120003 | Произошла ошибка. Такой услуги не существует.'),
          );
        }
      }

      const services_full = await Promise.all(
        services.map(async service_id => {
          const service = await Procedure.findOne({
            where: { id: service_id, branchId: branch.id },
          });
          return service;
        }),
      );

      const serviceDuration = services_full.reduce((accum, item) => accum + item.duration, 0);

      const days = [
        'воскресенье',
        'понедельник',
        'вторник',
        'среда',
        'четверг',
        'пятница',
        'суббота',
      ];

      const selectedDate = new Date(date);
      const dateStringArray = selectedDate
        .toLocaleDateString('ru-RU', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
        .split(' ');
      const dateString = moment(selectedDate).format('dddd, D MMMM');

      return res.json({
        tenant,
        branch,
        services: services_full,
        employee: employeeInfo,
        dateString,
        serviceDuration,
      });
    } catch (e) {
      next(ApiError.badRequest(e.message));
    }
  }

  async getRecord(req, res, next) {
    try {
      const { receptionId, branchId } = req.query;

      console.log('\n\n\n' + receptionId + '\n' + branchId + '\n\n\n');

      if (!receptionId || !branchId) {
        return next(
          ApiError.badRequest(
            '01120001 | Произошла ошибка. Не передан идентификатор записи или филиала.',
          ),
        );
      }

      const branch = await Branch.findOne({
        where: { id: branchId },
      });

      if (!branch) {
        return next(
          ApiError.badRequest('01120003 | Произошла ошибка. Такого филиала не существует.'),
        );
      }

      const reception = await Reception.findOne({
        where: { id: receptionId, branchId },
        include: [
          {
            model: Doctor,
            where: { id: { [Op.col]: 'doctorId' }, branchId },
            include: [
              {
                model: Position,
                required: false,
                attributes: ['name'],
                where: { id: { [Op.col]: 'positionId' }, branchId },
              },
            ],
          },
          { model: Client, where: { id: { [Op.col]: 'clientId' }, branchId } },
          {
            model: ReceptionProcedure,
            required: false,
            attributes: ['id'],
            where: { receptionId: { [Op.col]: 'reception.id' }, branchId },
            include: [{ model: Procedure, where: { id: { [Op.col]: 'procedureId' } } }],
          },
        ],
      });

      if (!reception) {
        return next(
          ApiError.badRequest('01120003 | Произошла ошибка. Такой записи не существует.'),
        );
      }

      console.log('\n\n\n' + branch.tenantId + '\n\n\n');

      const tenant = await Tenant.findOne({ where: { id: branch.tenantId } });

      const days = [
        'воскресенье',
        'понедельник',
        'вторник',
        'среда',
        'четверг',
        'пятница',
        'суббота',
      ];

      const selectedDate = new Date(reception.date);
      const dateStringArray = selectedDate
        .toLocaleDateString('ru-RU', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
        .split(' ');
      const dateString = moment(selectedDate).format('dddd, D MMMM');

      return res.json({ reception, branch, tenant, dateString });
    } catch (e) {
      next(ApiError.badRequest(e.message));
    }
  }

  async getTenant(req, res, next) {
    try {
      const { id } = req.params;

      if (!id) {
        return next(
          ApiError.badRequest(
            '01120001 | Произошла ошибка. Не передан идентификатор записи или филиала.',
          ),
        );
      }

      const userTenant = await Tenant.findByPk(id);
      return res.json(userTenant);
    } catch (e) {
      next(ApiError.badRequest(e.message));
    }
  }

  async getStatistics(req, res, next) {
    try {
      const { id } = req.params;

      if (!id) {
        return next(
          ApiError.badRequest('01120001 | Произошла ошибка. Не передан идентификатор филиала.'),
        );
      }

      const days_count = 30;
      let isNull = true;

      const date_start = moment(new Date()).subtract(30, 'days');

      let data = [];

      for (let i = 0; i <= days_count; i++) {
        const search_date = moment(date_start).add(i, 'days').format('YYYY-MM-DD');

        const records = await Reception.count({
          where: {
            date: search_date,
            branchId: id,
            is_widget_appointment: true,
          },
        });

        if (records > 0) {
          isNull = false;
        }

        data.push({ search_date, records });
      }

      if (isNull) {
        return res.json(null);
      }
      return res.json(data);
    } catch (e) {
      next(ApiError.badRequest(e.message));
    }
  }
}

module.exports = new onlineAppointmentController();

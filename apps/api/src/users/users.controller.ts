import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { IsString, Length, MinLength } from 'class-validator';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

export class OtpTokenDto {
  @IsString()
  @Length(6, 6)
  token: string;
}

export class ChangePasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  @MinLength(8)
  newPassword: string;
}

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @Roles('admin')
  findAll(@Request() req) {
    return this.usersService.findAll(req.user.organizationId);
  }

  @Get('me')
  getMe(@Request() req) {
    return this.usersService.findOne(req.user.id, req.user.organizationId);
  }

  @Put('me/password')
  changeMyPassword(@Body() dto: ChangePasswordDto, @Request() req) {
    return this.usersService.changeOwnPassword(req.user.id, dto.currentPassword, dto.newPassword);
  }

  // OTP routes — ANTES de :id para evitar conflictos
  @Post('otp/setup')
  otpSetup(@Request() req) {
    return this.usersService.otpSetup(req.user.id);
  }

  @Post('otp/verify')
  otpVerify(@Body() dto: OtpTokenDto, @Request() req) {
    return this.usersService.otpVerify(req.user.id, dto.token);
  }

  @Post('otp/disable')
  otpDisable(@Body() dto: OtpTokenDto, @Request() req) {
    return this.usersService.otpDisable(req.user.id, dto.token);
  }

  @Get(':id')
  @Roles('admin')
  findOne(@Param('id') id: string, @Request() req) {
    return this.usersService.findOne(id, req.user.organizationId);
  }

  @Post()
  @Roles('admin')
  create(@Body() dto: CreateUserDto, @Request() req) {
    return this.usersService.create(dto, req.user.organizationId);
  }

  @Put(':id')
  @Roles('admin')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @Request() req) {
    return this.usersService.update(id, dto, req.user.organizationId);
  }

  @Delete(':id')
  @Roles('admin')
  remove(@Param('id') id: string, @Request() req) {
    return this.usersService.remove(id, req.user.organizationId);
  }

  @Put(':id/reset-password')
  @Roles('admin')
  resetPassword(@Param('id') id: string, @Request() req) {
    return this.usersService.resetPassword(id, req.user.organizationId);
  }
}

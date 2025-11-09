import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { UsersService } from '../services/users.service';
import { UpdateUserDto } from '../dto/users/update-user.dto';
import { User } from '../entities/user.entity';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@CurrentUser() user: User): Promise<Partial<User>> {
    const fullUser = await this.usersService.findById(user.id);

    if (!fullUser) {
      return this.sanitizeUser(user);
    }

    return this.sanitizeUser(fullUser);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  async updateMe(
    @CurrentUser() user: User,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<Partial<User>> {
    const updatedUser = await this.usersService.update(user.id, updateUserDto);
    return this.sanitizeUser(updatedUser);
  }

  private sanitizeUser(user: User): Partial<User> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...sanitized } = user;
    return sanitized;
  }
}
